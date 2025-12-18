(function(){
	'use strict';

	// ---------------------- Send Message Modal ----------------------
	function openSendMessageModal() {
		const invoiceNumber = getCurrentInvoiceNumber();
		const customerName = getCurrentCustomerName();
		
		if (!invoiceNumber) {
			alert('Please select or load an invoice first.');
			return;
		}
		
		if (!customerName) {
			alert('No customer found for this invoice.');
			return;
		}

		const overlay = document.createElement('div');
		overlay.className = 'modal-overlay';
		overlay.id = 'sendMessageModalOverlay';
		overlay.style.zIndex = '10050';

		const content = document.createElement('div');
		content.className = 'modal-content';
		content.style.maxWidth = '600px';

		const header = document.createElement('div');
		header.className = 'modal-header';
		header.innerHTML = `
			<h3>Send Message</h3>
			<button class="modal-close" title="Close">&times;</button>
		`;

		const body = document.createElement('div');
		body.className = 'modal-body';
		body.innerHTML = `
			<div style="display:flex; flex-direction:column; gap:16px;">
				<div style="display:flex; flex-direction:column; gap:4px;">
					<label style="font-weight:bold; font-size:12px;">Invoice Number:</label>
					<input type="text" id="messageInvoiceNumber" value="${invoiceNumber}" readonly style="padding:8px; border:1px solid #ccc; border-radius:4px; background:#f5f5f5;">
				</div>
				
				<div style="display:flex; flex-direction:column; gap:4px;">
					<label style="font-weight:bold; font-size:12px;">Client Name:</label>
					<input type="text" id="messageClientName" value="${customerName}" readonly style="padding:8px; border:1px solid #ccc; border-radius:4px; background:#f5f5f5;">
				</div>
				
				<div style="display:flex; flex-direction:column; gap:4px;">
					<label style="font-weight:bold; font-size:12px;">Message: <span style="color:red">*</span></label>
					<textarea id="messageText" rows="6" placeholder="Enter your message here..." style="padding:8px; border:1px solid #ccc; border-radius:4px; resize:vertical; font-family:inherit;"></textarea>
				</div>
			</div>
		`;

		const actions = document.createElement('div');
		actions.className = 'form-actions';
		actions.style.justifyContent = 'space-between';
		actions.style.gap = '12px';
		actions.style.marginTop = '16px';
		actions.innerHTML = `
			<button type="button" class="cancel-btn btn" id="viewMessagesBtn">View Messages</button>
			<div style="display:flex; gap:12px;">
				<button type="button" class="cancel-btn btn" id="cancelMessageBtn">Cancel</button>
				<button type="button" class="save-client-btn btn" id="sendMessageBtn">Send</button>
			</div>
		`;

		content.appendChild(header);
		content.appendChild(body);
		content.appendChild(actions);
		overlay.appendChild(content);

		// Add handlers
		header.querySelector('.modal-close').onclick = closeSendMessageModal;
		actions.querySelector('#cancelMessageBtn').onclick = closeSendMessageModal;
		actions.querySelector('#viewMessagesBtn').onclick = () => {
			openViewMessagesModal();
		};
		
		// Check and update badge on View Messages button
		if (typeof window.checkMessageUpdates === 'function') {
			window.checkMessageUpdates();
		}
		
		actions.querySelector('#sendMessageBtn').onclick = async () => {
			const messageText = body.querySelector('#messageText').value.trim();
			
			if (!messageText) {
				alert('Please enter a message.');
				return;
			}
			
			try {
				// Disable send button
				const sendBtn = actions.querySelector('#sendMessageBtn');
				sendBtn.disabled = true;
				sendBtn.textContent = 'Sending...';
				
				// Prepare data
				const now = new Date();
				const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
				
				const messageData = [
					timestamp,                  // 1. Date and Time
					invoiceNumber,              // 2. Invoice
					customerName,               // 3. Client
					messageText,                // 4. Message
					'Pending',                  // 5. Status
					'Not Replied',              // 6. Reply Status
					'No Response'               // 7. Response Status
				];
				
				// Send to Google Sheets
				if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
					const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
					const SHEET_NAME = 'Messages';
					const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
					
					await window.ServiceAccountAuth.fetch(appendUrl, {
						method: 'POST',
						body: JSON.stringify({ values: [messageData] })
					});
					
					console.log('Message sent successfully to Google Sheets');
					alert('✅ Message sent successfully!');
					closeSendMessageModal();
				} else {
					throw new Error('Google Sheets authentication not available');
				}
			} catch (e) {
				console.error('Failed to send message:', e);
				alert('❌ Failed to send message. Please check your connection and try again.');
				
				// Re-enable button
				const sendBtn = actions.querySelector('#sendMessageBtn');
				sendBtn.disabled = false;
				sendBtn.textContent = 'Send';
			}
		};

		// Insert overlay
		document.body.appendChild(overlay);
		document.body.style.overflow = 'hidden';
		
		// Focus on message textarea
		setTimeout(() => {
			const textarea = body.querySelector('#messageText');
			if (textarea) textarea.focus();
		}, 100);
	}

	function closeSendMessageModal() {
		const overlay = document.getElementById('sendMessageModalOverlay');
		if (overlay) {
			overlay.remove();
			document.body.style.overflow = '';
		}
	}

	function getCurrentInvoiceNumber() {
		const el = document.getElementById('invoiceNumber');
		return el ? el.value.trim() : '';
	}

	function getCurrentCustomerName() {
		const el = document.getElementById('clientNameDisplay');
		return el ? el.textContent.trim() : '';
	}

	// ---------------------- View Messages Modal ----------------------
	async function openViewMessagesModal() {
		const overlay = document.createElement('div');
		overlay.className = 'modal-overlay';
		overlay.id = 'viewMessagesModalOverlay';
		overlay.style.zIndex = '10060';

		const content = document.createElement('div');
		content.className = 'modal-content';
		content.style.maxWidth = '1200px';
		content.style.maxHeight = '80vh';

		const header = document.createElement('div');
		header.className = 'modal-header';
		header.innerHTML = `
			<h3>Messages - Not Replied</h3>
			<button class="modal-close" title="Close">&times;</button>
		`;

		const body = document.createElement('div');
		body.className = 'modal-body';
		body.innerHTML = `
			<div style="text-align:center; padding:20px;">
				<div style="font-size:14px; color:#666;">Loading messages...</div>
			</div>
		`;

		const actions = document.createElement('div');
		actions.className = 'form-actions';
		actions.style.justifyContent = 'flex-end';
		actions.style.gap = '12px';
		actions.style.marginTop = '16px';
		actions.innerHTML = `
			<button type="button" class="cancel-btn btn" id="closeViewMessagesBtn">Close</button>
		`;

		content.appendChild(header);
		content.appendChild(body);
		content.appendChild(actions);
		overlay.appendChild(content);

		// Add handlers
		header.querySelector('.modal-close').onclick = closeViewMessagesModal;
		actions.querySelector('#closeViewMessagesBtn').onclick = closeViewMessagesModal;

		// Insert overlay
		document.body.appendChild(overlay);

		// Load messages from Google Sheets
		try {
			if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
				const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
				const SHEET_NAME = 'Messages';
				const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:G`;
				
				const response = await window.ServiceAccountAuth.fetch(getUrl, { method: 'GET' });
				const data = await response.json();
				
				console.log('Messages data received:', data);
				
				if (data.values && data.values.length > 0) {
					// Check if first row is a header by checking if it contains typical header text
					const firstRow = data.values[0];
					const isHeaderRow = firstRow.some(cell => 
						(cell || '').toLowerCase().includes('date') || 
						(cell || '').toLowerCase().includes('invoice') || 
						(cell || '').toLowerCase().includes('client')
					);
					
					// Skip first row only if it's a header
					const dataRows = isHeaderRow ? data.values.slice(1) : data.values;
					
					console.log('Total rows (excluding header if present):', dataRows.length);
					console.log('Header row:', firstRow);
					
					// Filter for "Not Replied" and "Update" - check column 5 (Reply Status)
					const messages = dataRows.filter(row => {
						if (!row || row.length < 6) return false;
						const replyStatus = (row[5] || '').toString().trim().toLowerCase();
						console.log('Row reply status:', replyStatus, '| Raw:', row[5]);
						return replyStatus === 'not replied' || replyStatus === 'update';
					});
					
					// Check if there are any "Update" status messages for notification badge
					const hasUpdates = messages.some(row => {
						const replyStatus = (row[5] || '').toString().trim().toLowerCase();
						return replyStatus === 'update';
					});
					
					// Update toolbar badge
					if (typeof window.updateMessageNotificationBadge === 'function') {
						window.updateMessageNotificationBadge(hasUpdates);
					}
					
					console.log('Filtered unreplied/update messages:', messages.length, '| Has updates:', hasUpdates);
					
					if (messages.length === 0) {
						body.innerHTML = `
							<div style="text-align:center; padding:40px;">
								<div style="font-size:16px; color:#666;">No unreplied messages found.</div>
								<div style="font-size:12px; color:#999; margin-top:8px;">Total messages in sheet: ${dataRows.length}</div>
							</div>
						`;
					} else {
						// Build table
						let tableHTML = `
							<div style="overflow:auto; max-height:60vh;">
								<table style="width:100%; border-collapse:collapse; font-size:12px;">
									<thead>
										<tr style="background:#f8f9fa; position:sticky; top:0;">
											<th style="border:1px solid #ddd; padding:8px; text-align:left; min-width:150px;">Date and Time</th>
											<th style="border:1px solid #ddd; padding:8px; text-align:left; min-width:120px;">Invoice</th>
											<th style="border:1px solid #ddd; padding:8px; text-align:left; min-width:150px;">Client</th>
											<th style="border:1px solid #ddd; padding:8px; text-align:left; min-width:250px;">Message</th>
											<th style="border:1px solid #ddd; padding:8px; text-align:left; min-width:100px;">Status</th>
											<th style="border:1px solid #ddd; padding:8px; text-align:left; min-width:100px;">Reply Status</th>
											<th style="border:1px solid #ddd; padding:8px; text-align:left; min-width:200px;">Response Status</th>
										</tr>
									</thead>
									<tbody>
						`;
						
						messages.forEach(row => {
							const timestamp = row[0] || '';
							const invoice = row[1] || '';
							const client = row[2] || '';
							const message = row[3] || '';
							const status = row[4] || '';
							const replyStatus = row[5] || '';
							const responseStatus = row[6] || '';
							
							tableHTML += `
								<tr style="border:1px solid #ddd;">
									<td style="border:1px solid #ddd; padding:8px;">${timestamp}</td>
									<td style="border:1px solid #ddd; padding:8px;">${invoice}</td>
									<td style="border:1px solid #ddd; padding:8px;">${client}</td>
									<td style="border:1px solid #ddd; padding:8px; white-space:pre-wrap;">${message}</td>
									<td style="border:1px solid #ddd; padding:8px;">${status}</td>
									<td style="border:1px solid #ddd; padding:8px;">${replyStatus}</td>
									<td style="border:1px solid #ddd; padding:8px; white-space:pre-wrap;">${responseStatus}</td>
								</tr>
							`;
						});
						
						tableHTML += `
									</tbody>
								</table>
							</div>
							<div style="margin-top:12px; padding:8px; background:#f0f9ff; border-radius:4px; font-size:12px; color:#333;">
								Total unreplied messages: <strong>${messages.length}</strong>
							</div>
						`;
						
						body.innerHTML = tableHTML;
					}
				} else {
					body.innerHTML = `
						<div style="text-align:center; padding:40px;">
							<div style="font-size:16px; color:#666;">No messages found in the sheet.</div>
						</div>
					`;
				}
			} else {
				throw new Error('Google Sheets authentication not available');
			}
		} catch (e) {
			console.error('Failed to load messages:', e);
			body.innerHTML = `
				<div style="text-align:center; padding:40px;">
					<div style="font-size:16px; color:#dc2626;">Failed to load messages.</div>
					<div style="font-size:12px; color:#666; margin-top:8px;">Please check your connection and try again.</div>
				</div>
			`;
		}
	}

	function closeViewMessagesModal() {
		const overlay = document.getElementById('viewMessagesModalOverlay');
		if (overlay) {
			overlay.remove();
		}
	}

	// Expose functions globally
	window.openSendMessageModal = openSendMessageModal;
	window.closeSendMessageModal = closeSendMessageModal;
	window.openViewMessagesModal = openViewMessagesModal;
	window.closeViewMessagesModal = closeViewMessagesModal;
	
	// Global function to update message notification badge
	window.updateMessageNotificationBadge = function(showBadge) {
		console.log('🔔 updateMessageNotificationBadge called with showBadge:', showBadge);
		
		// Update toolbar message button
		const messageBtn = document.getElementById('toolbarSendMessageBtn');
		console.log('📍 Message button found:', !!messageBtn);
		
		if (messageBtn) {
			// Remove existing badge if present
			const existingBadge = messageBtn.querySelector('.notification-badge');
			if (existingBadge) existingBadge.remove();
			
			if (showBadge) {
				console.log('✨ Adding badge to toolbar button');
				// Add red notification badge
				const badge = document.createElement('span');
				badge.className = 'notification-badge';
				badge.style.cssText = `
					position: absolute;
					top: -4px;
					right: -4px;
					width: 12px;
					height: 12px;
					background: #dc2626;
					border-radius: 50%;
					border: 2px solid #059669;
					box-shadow: 0 2px 4px rgba(0,0,0,0.3);
					animation: pulse-badge 2s infinite;
				`;
				messageBtn.style.position = 'relative';
				messageBtn.appendChild(badge);
			}
		}
		
		// Update "View Messages" button in modal if it exists
		const viewMessagesBtn = document.getElementById('viewMessagesBtn');
		if (viewMessagesBtn) {
			// Remove existing badge if present
			const existingBadge = viewMessagesBtn.querySelector('.notification-badge');
			if (existingBadge) existingBadge.remove();
			
			if (showBadge) {
				// Add red notification badge
				const badge = document.createElement('span');
				badge.className = 'notification-badge';
				badge.style.cssText = `
					position: absolute;
					top: -2px;
					right: -2px;
					width: 10px;
					height: 10px;
					background: #dc2626;
					border-radius: 50%;
					border: 2px solid #6b7280;
					box-shadow: 0 2px 4px rgba(0,0,0,0.3);
					animation: pulse-badge 2s infinite;
				`;
				viewMessagesBtn.style.position = 'relative';
				viewMessagesBtn.appendChild(badge);
			}
		}
	};
	
	// Function to check for message updates without opening modal
	window.checkMessageUpdates = async function() {
		console.log('🔍 checkMessageUpdates() started');
		try {
			if (!window.ServiceAccountAuth || typeof window.ServiceAccountAuth.fetch !== 'function') {
				console.log('❌ ServiceAccountAuth not available yet');
				return;
			}
			
			console.log('✅ ServiceAccountAuth available, fetching messages...');
			const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '17gh8MZSeFVPQudyTGwYf5_pFWH8yt-xpCPiPy9i8x-U';
			const SHEET_NAME = 'Messages';
			const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:G`;
			
			const response = await window.ServiceAccountAuth.fetch(url);
			const data = await response.json();
			console.log('📦 Messages data received:', data.values ? data.values.length + ' rows' : 'no data');
			
			if (!data || !data.values || data.values.length === 0) {
				console.log('No messages found in sheet');
				return;
			}
			
			const firstRow = data.values[0];
			const isHeaderRow = firstRow && firstRow.length > 0 && (
				firstRow[0].toLowerCase().includes('date') || 
				firstRow[0].toLowerCase().includes('time')
			);
			
			const dataRows = isHeaderRow ? data.values.slice(1) : data.values;
			
			// Check if there are any "Update" status messages
			let updateCount = 0;
			const hasUpdates = dataRows.some(row => {
				if (!row || row.length < 6) return false;
				const replyStatus = (row[5] || '').toString().trim().toLowerCase();
				if (replyStatus === 'update') {
					updateCount++;
					return true;
				}
				return false;
			});
			
			// Update badge - only show if hasUpdates is true
			if (typeof window.updateMessageNotificationBadge === 'function') {
				window.updateMessageNotificationBadge(hasUpdates);
			}
			
			if (hasUpdates) {
				console.log(`✉️ Message updates found: ${updateCount} message(s) with "Update" status`);
			} else {
				console.log('✓ No message updates - badge hidden');
			}
		} catch (error) {
			console.error('Error checking message updates:', error);
		}
	};
	
	// Message updates are checked automatically after data is loaded (see data_loader.js)
	// No auto-check on page load - badge only shows after user loads data

})();
