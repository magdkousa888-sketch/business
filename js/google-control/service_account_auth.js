// service_account_auth.js - Client-side service account authentication
// ⚠️ WARNING: This exposes the private key in the browser
// Only use for single-user local applications, not for public/hosted apps
(function() {
  'use strict';

  const ServiceAccountAuth = {
    credentials: null,
    accessToken: null,
    tokenExpiry: null,
    directoryHandle: null,

    /**
     * Load service account credentials from user-selected folder
     */
    async loadCredentials() {
      if (this.credentials) return this.credentials;

      try {
        // Get stored directory handle
        const db = await this.openDB();
        const tx = db.transaction('handles', 'readonly');
        const store = tx.objectStore('handles');
        this.directoryHandle = await new Promise((resolve, reject) => {
          const request = store.get('invoiceApp_credentialsFolder');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        if (!this.directoryHandle) {
          throw new Error('No credentials folder selected. Please select folder from settings.');
        }

        // Check and request permission if needed
        const permission = await this.directoryHandle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') {
          const newPermission = await this.directoryHandle.requestPermission({ mode: 'read' });
          if (newPermission !== 'granted') {
            throw new Error('Permission denied to access credentials folder');
          }
        }

        // Load service account file
        const serviceAccountFile = await this.directoryHandle.getFileHandle('service-account.json');
        const fileData = await serviceAccountFile.getFile();
        this.credentials = JSON.parse(await fileData.text());
        
        console.log('✅ Service account credentials loaded');
        console.log('📧 Service account:', this.credentials.client_email);
        return this.credentials;
      } catch (error) {
        console.error('Failed to load service account:', error);
        throw new Error('Please select a valid Folder from settings.');
      }
    },

    /**
     * Open IndexedDB
     */
    openDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('InvoiceAppDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('handles')) {
            db.createObjectStore('handles');
          }
        };
      });
    },

    /**
     * Generate JWT token for Google API authentication
     */
    async generateJWT() {
      if (!this.credentials) {
        await this.loadCredentials();
      }

      const header = {
        alg: 'RS256',
        typ: 'JWT'
      };

      const now = Math.floor(Date.now() / 1000);
      const claim = {
        iss: this.credentials.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
      };

      // Base64url encode
      const base64url = (str) => {
        return btoa(str)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      };

      const headerB64 = base64url(JSON.stringify(header));
      const claimB64 = base64url(JSON.stringify(claim));
      const unsignedToken = `${headerB64}.${claimB64}`;

      // Sign with private key using Web Crypto API
      try {
        const signature = await this.signJWT(unsignedToken, this.credentials.private_key);
        return `${unsignedToken}.${signature}`;
      } catch (error) {
        console.error('JWT signing failed:', error);
        throw new Error('Failed to generate JWT token');
      }
    },

    /**
     * Sign JWT using RSA-SHA256
     */
    async signJWT(data, privateKeyPem) {
      // Import private key
      const pemHeader = '-----BEGIN PRIVATE KEY-----';
      const pemFooter = '-----END PRIVATE KEY-----';
      const pemContents = privateKeyPem
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\\n/g, '')
        .replace(/\\r/g, '')
        .replace(/\n/g, '')
        .replace(/\r/g, '')
        .trim();

      const binaryDer = this.base64ToArrayBuffer(pemContents);

      const key = await crypto.subtle.importKey(
        'pkcs8',
        binaryDer,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256'
        },
        false,
        ['sign']
      );

      // Sign the data
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        dataBuffer
      );

      // Convert to base64url
      const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    },

    /**
     * Convert base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    },

    /**
     * Exchange JWT for access token
     */
    async getAccessToken() {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const jwt = await this.generateJWT();

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Token exchange failed:', error);
        throw new Error('Failed to get access token from Google');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early

     // console.log('✅ Access token obtained');
      return this.accessToken;
    },

    /**
     * Make authenticated request to Google Sheets API
     */
    async fetch(url, options = {}) {
      const token = await this.getAccessToken();
      
      const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      return fetch(url, {
        ...options,
        headers
      });
    }
  };

  // Expose to window
  window.ServiceAccountAuth = ServiceAccountAuth;
  
  //console.log('✅ service_account_auth.js loaded');
})();
