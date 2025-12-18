(function(){
    // Navigation module: handles prev/next and long-press jump-to-first/last
    const NAV = {};

    // Utility: ensure local/global arrays are synced
    function ensureSynced() {
        if (typeof window.syncGlobalArrays === 'function') window.syncGlobalArrays();
        if (typeof window.updateUniqueInvoiceNumbers === 'function') window.updateUniqueInvoiceNumbers();
    }

    // Parse invoice reference using dataLoader if available
    function parseRef(ref) {
        if (window.dataLoader && typeof window.dataLoader.parseInvoiceReference === 'function') {
            try { return window.dataLoader.parseInvoiceReference(ref); } catch (e) { /* ignore */ }
        }
        const s = String(ref || '').trim();
        const m = s.match(/(\d+)/);
        return { prefix: '', num: m ? parseInt(m[0],10) : 0, pad: m ? m[0].length : 1, suffix: '', original: ref };
    }

    // Find index of invoice with minimal/maximal numeric part (robust first/last)
    function findFirstLastIndexes() {
        ensureSynced();
        const arr = Array.isArray(window.uniqueInvoiceNumbers) ? window.uniqueInvoiceNumbers : [];
        if (arr.length === 0) return {first: -1, last: -1};

        let firstIdx = 0, lastIdx = 0;
        let firstNum = Infinity, lastNum = -Infinity;

        arr.forEach((inv, idx) => {
            const p = parseRef(inv);
            const num = (typeof p.num === 'number') ? p.num : 0;
            if (num < firstNum) { firstNum = num; firstIdx = idx; }
            if (num > lastNum) { lastNum = num; lastIdx = idx; }
        });

        // If parsing didn't produce meaningful numbers (all zeros), fallback to array order
        if (firstNum === Infinity || lastNum === -Infinity) {
            return { first: 0, last: arr.length - 1 };
        }
        return { first: firstIdx, last: lastIdx };
    }

    // Navigation actions
    NAV.showPrevInvoice = function() {
        // Check for unsaved cloned invoice before navigation
        if (window.hasUnsavedClonedInvoice) {
            const confirmNav = confirm('You have an unsaved cloned invoice. If you navigate away, your changes will be lost.\n\nClick OK to discard changes and navigate, or Cancel to stay and save the invoice.');
            if (!confirmNav) return;
            window.hasUnsavedClonedInvoice = false;
        }
        
        // Defensive: cancel any pending long-press timers to avoid delayed trigger
        try { if (typeof navigationLongPress !== 'undefined' && navigationLongPress && typeof navigationLongPress.clearPressState === 'function') navigationLongPress.clearPressState(navigationLongPress.currentButton); } catch (e) { /* ignore */ }
        // Ignore clicks triggered immediately after a long-press
        if (NAV._longPressActive) { console.log('showPrevInvoice suppressed by long-press flag'); return; }
        ensureSynced();
        
        // Use filtered invoices if filters are active
        const useFiltered = window.isFiltered && Array.isArray(window.filteredInvoiceNumbers) && window.filteredInvoiceNumbers.length > 0;
        const navArray = useFiltered ? window.filteredInvoiceNumbers : window.uniqueInvoiceNumbers;
        
        if (!Array.isArray(navArray) || navArray.length === 0) {
            alert('No invoices available' + (useFiltered ? ' matching current filters.' : ' in table. Please save some invoices first.'));
            return;
        }
        if (typeof window.currentInvoiceIndex !== 'number') window.currentInvoiceIndex = -1;
        
        // If no valid index, start from the end (latest invoice)
        if (window.currentInvoiceIndex < 0 || window.currentInvoiceIndex >= navArray.length) {
            window.currentInvoiceIndex = navArray.length - 1;
        }
        
        if (window.currentInvoiceIndex > 0) {
            window.currentInvoiceIndex -= 1;
            if (typeof window.showInvoice === 'function') window.showInvoice(window.currentInvoiceIndex);
            if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
            console.log(`Navigated to previous invoice: ${window.currentInvoiceIndex + 1}/${navArray.length}` + (useFiltered ? ' (filtered)' : ''));
        }
    };

    NAV.showNextInvoice = function() {
        // Check for unsaved cloned invoice before navigation
        if (window.hasUnsavedClonedInvoice) {
            const confirmNav = confirm('You have an unsaved cloned invoice. If you navigate away, your changes will be lost.\n\nClick OK to discard changes and navigate, or Cancel to stay and save the invoice.');
            if (!confirmNav) return;
            window.hasUnsavedClonedInvoice = false;
        }
        
        // Defensive: cancel any pending long-press timers to avoid delayed trigger
        try { if (typeof navigationLongPress !== 'undefined' && navigationLongPress && typeof navigationLongPress.clearPressState === 'function') navigationLongPress.clearPressState(navigationLongPress.currentButton); } catch (e) { /* ignore */ }
        // Ignore clicks triggered immediately after a long-press
        if (NAV._longPressActive) { console.log('showNextInvoice suppressed by long-press flag'); return; }
        ensureSynced();
        
        // Use filtered invoices if filters are active
        const useFiltered = window.isFiltered && Array.isArray(window.filteredInvoiceNumbers) && window.filteredInvoiceNumbers.length > 0;
        const navArray = useFiltered ? window.filteredInvoiceNumbers : window.uniqueInvoiceNumbers;
        
        if (!Array.isArray(navArray) || navArray.length === 0) {
            alert('No invoices available' + (useFiltered ? ' matching current filters.' : ' in table. Please save some invoices first.'));
            return;
        }
        if (typeof window.currentInvoiceIndex !== 'number') window.currentInvoiceIndex = -1;
        
        // If no valid index, start from the end (latest invoice)
        if (window.currentInvoiceIndex < 0 || window.currentInvoiceIndex >= navArray.length) {
            window.currentInvoiceIndex = navArray.length - 1;
        }
        
        if (window.currentInvoiceIndex < navArray.length - 1) {
            window.currentInvoiceIndex += 1;
            if (typeof window.showInvoice === 'function') window.showInvoice(window.currentInvoiceIndex);
            if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
            console.log(`Navigated to next invoice: ${window.currentInvoiceIndex + 1}/${navArray.length}` + (useFiltered ? ' (filtered)' : ''));
        }
    };

    NAV.goToFirstInvoice = function() {
        ensureSynced();
        const arr = Array.isArray(window.uniqueInvoiceNumbers) ? window.uniqueInvoiceNumbers : [];
        if (arr.length === 0) return;
        const firstIdx = 0;
        // mark long-press active briefly to prevent the following click from firing navigation
        NAV._longPressActive = true;
        setTimeout(() => { NAV._longPressActive = false; }, 500);
        window.currentInvoiceIndex = firstIdx;
        if (typeof window.showInvoice === 'function') window.showInvoice(window.currentInvoiceIndex);
        if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
        console.log('goToFirstInvoice -> index', firstIdx, 'invoice', window.uniqueInvoiceNumbers[firstIdx]);
        return firstIdx;
    };

    NAV.goToLastInvoice = function() {
        ensureSynced();
        const arr = Array.isArray(window.uniqueInvoiceNumbers) ? window.uniqueInvoiceNumbers : [];
        if (arr.length === 0) return;
        const lastIdx = arr.length - 1;
        // mark long-press active briefly to prevent the following click from firing navigation
        NAV._longPressActive = true;
        setTimeout(() => { NAV._longPressActive = false; }, 500);
        window.currentInvoiceIndex = lastIdx;
        if (typeof window.showInvoice === 'function') window.showInvoice(window.currentInvoiceIndex);
        if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
        console.log('goToLastInvoice -> index', lastIdx, 'invoice', window.uniqueInvoiceNumbers[lastIdx]);
        return lastIdx;
    };

    // Long-press navigation functionality
    class NavigationLongPress {
        constructor() {
            this.pressTimer = null;
            this.preTimer = null;
            this.isLongPress = false;
            this.pressStartTime = null;
            this.longPressThreshold = 3000; // ms (3 seconds)
            this.progressInterval = null;
            this.currentButton = null;
        }

        initializeLongPress() {
            const prevBtn = document.getElementById('prevInvBtn');
            const nextBtn = document.getElementById('nextInvBtn');
            if (prevBtn) {
                this.attachLongPressListeners(prevBtn, 'prev');
                // capture-phase click blocker to ignore the click immediately after a long-press
                prevBtn.addEventListener('click', (e) => {
                        if (prevBtn.dataset.longPressed === '1') {
                            console.log('capture-click: prev button suppressed due to longPressed flag');
                            prevBtn.dataset.longPressed = '0';
                            try { e.stopImmediatePropagation(); e.preventDefault(); } catch (ex) {}
                        }
                }, true);
            }
            if (nextBtn) {
                this.attachLongPressListeners(nextBtn, 'next');
                // capture-phase click blocker to ignore the click immediately after a long-press
                nextBtn.addEventListener('click', (e) => {
                    if (nextBtn.dataset.longPressed === '1') {
                        console.log('capture-click: next button suppressed due to longPressed flag');
                        nextBtn.dataset.longPressed = '0';
                        try { e.stopImmediatePropagation(); e.preventDefault(); } catch (ex) {}
                    }
                }, true);
            }
        }

        attachLongPressListeners(button, direction) {
            // Use Pointer events to avoid hover-related synthetic events
            button.addEventListener('pointerdown', (e) => { try { this.startPress(e, button, direction); } catch (ex) { console.error(ex); } });
            button.addEventListener('pointerup', (e) => { try { this.endPress(e, button, direction); } catch (ex) { console.error(ex); } });
            button.addEventListener('pointerleave', (e) => { try { this.cancelPress(e, button); } catch (ex) { console.error(ex); } });
            button.addEventListener('pointercancel', (e) => { try { this.cancelPress(e, button); } catch (ex) { console.error(ex); } });
            this.updateButtonTooltips(button, direction);
        }

        startPress(event, button, direction) {
            if (button.disabled) return;
            // Only start when it's an actual pointerdown (avoid hover)
            this.currentButton = button;
            this.isLongPress = false;
            this.pressStartTime = Date.now();
            this.inputType = event && (event.pointerType || event.type || 'mouse');
            console.log('startPress', {buttonId: button && button.id, direction: direction, inputType: this.inputType});
            // Small delay before starting the long-press timer to avoid triggering on quick clicks
            this.preTimer = setTimeout(() => {
                // Only start visual progress and timer when the pointer is still down after the small delay
                try {
                    if (!button) return;
                    button.classList.add('nav-btn-pressed');
                    this.startProgressIndicator(button);
                    this.pressTimer = setTimeout(() => { this.triggerLongPress(direction); }, this.longPressThreshold);
                } catch (ex) { console.error('preTimer start error', ex); }
            }, 150); // 150ms pre-delay
        }

        endPress(event, button, direction) {
            // Compute duration defensively (preTimer may have run or not)
            const pressDuration = this.pressStartTime ? (Date.now() - this.pressStartTime) : 0;
            const isTouch = (this.inputType && String(this.inputType).startsWith('touch')) || false;
            // Always clear any pending timers (preTimer/pressTimer) to avoid delayed long-press
            this.clearPressState(button);
            console.log('endPress', {buttonId: button && button.id, direction: direction, duration: pressDuration, inputType: this.inputType, isTouch: isTouch, isLongPress: this.isLongPress});
            // Short press handling: for pointer devices, treat as click - let click handler run
            // For touch we also trigger short press here to ensure the action occurs on touch
            if (pressDuration < this.longPressThreshold && !this.isLongPress) {
                if (isTouch) {
                    if (direction === 'prev') NAV.showPrevInvoice(); else NAV.showNextInvoice();
                }
            }
        }

        cancelPress(event, button) { this.clearPressState(button); }

        clearPressState(button) {
            if (this.preTimer) { clearTimeout(this.preTimer); this.preTimer = null; }
            if (this.pressTimer) { clearTimeout(this.pressTimer); this.pressTimer = null; }
            if (this.progressInterval) { clearInterval(this.progressInterval); this.progressInterval = null; }
            if (button) { button.classList.remove('nav-btn-pressed'); this.removeProgressIndicator(button); }
            this.isLongPress = false; this.currentButton = null; this.pressStartTime = null;
        }

        triggerLongPress(direction) {
            this.isLongPress = true;
            const arr = Array.isArray(window.uniqueInvoiceNumbers) ? window.uniqueInvoiceNumbers : [];
            if (arr.length === 0) { this.showNavigationError('No invoices available'); return; }
            if (direction === 'prev') {
                const idx = NAV.goToFirstInvoice();
                this.showNavigationSuccess(idx !== undefined ? `Jumped to first invoice: ${window.uniqueInvoiceNumbers[idx]}` : 'Jumped to first invoice');
                if (this.currentButton) this.currentButton.dataset.longPressed = '1';
            } else {
                const idx = NAV.goToLastInvoice();
                this.showNavigationSuccess(idx !== undefined ? `Jumped to last invoice: ${window.uniqueInvoiceNumbers[idx]}` : 'Jumped to last invoice');
                if (this.currentButton) this.currentButton.dataset.longPressed = '1';
            }
            console.log('triggerLongPress', {direction: direction, indexJumpedTo: window.currentInvoiceIndex});
            if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
            this.addSuccessAnimation(this.currentButton);
        }

        // (click suppression handled via data-longPressed + capture listener attached in initializeLongPress)

        startProgressIndicator(button) {
            const progressOverlay = document.createElement('div');
            progressOverlay.className = 'nav-progress-overlay';
            progressOverlay.innerHTML = `<div class="nav-progress-circle"><svg class="nav-progress-ring" width="30" height="30"><circle class="nav-progress-ring-circle" cx="15" cy="15" r="12" fill="transparent" stroke="#914345" stroke-width="5" stroke-dasharray="75.4" stroke-dashoffset="75.4"></circle></svg><span class="nav-progress-icon"></span></div>`;
            button.appendChild(progressOverlay);
            let progress = 0; const progressStep = 100 / (this.longPressThreshold / 50);
            this.progressInterval = setInterval(() => {
                progress += progressStep;
                const circle = progressOverlay.querySelector('.nav-progress-ring-circle');
                const circumference = 75.4;
                const offset = circumference - (progress / 100) * circumference;
                if (circle) circle.style.strokeDashoffset = offset;
                if (progress >= 100) { clearInterval(this.progressInterval); this.progressInterval = null; }
            }, 50);
        }

        removeProgressIndicator(button) { const progressOverlay = button.querySelector('.nav-progress-overlay'); if (progressOverlay) progressOverlay.remove(); }

        updateButtonTooltips(button, direction) { const shortAction = direction === 'prev' ? 'Previous invoice' : 'Next invoice'; const longAction = direction === 'prev' ? 'first invoice' : 'last invoice'; button.title = `${shortAction} (hold 3s for ${longAction})`; }

        showNavigationSuccess(message) { this.showNavigationToast(message, 'success'); }
        showNavigationError(message) { this.showNavigationToast(message, 'error'); }
        showNavigationToast(message, type) {
            const toast = document.createElement('div'); toast.className = `nav-toast nav-toast-${type}`;
            toast.innerHTML = `<span class="nav-toast-icon">${type === 'success' ? '✅' : '❌'}</span><span class="nav-toast-message">${message}</span>`;
            document.body.appendChild(toast);
            setTimeout(() => { toast.classList.add('nav-toast-fade-out'); setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300); }, 3000);
        }

        addSuccessAnimation(button) { if (!button) return; button.classList.add('nav-btn-success'); setTimeout(() => { button.classList.remove('nav-btn-success'); }, 1000); }
    }

    const navigationLongPress = new NavigationLongPress();

    NAV.initializeLongPress = function() { try { navigationLongPress.initializeLongPress(); } catch (e) { console.error('initializeLongPress error', e); } };

    // Expose
    window.navigation = window.navigation || {};
    Object.assign(window.navigation, NAV);
    // Provide updateInvoiceNavButtons implementation
    NAV.updateInvoiceNavButtons = function() {
        try {
            ensureSynced();
            const prevBtn = document.getElementById('prevInvBtn');
            const nextBtn = document.getElementById('nextInvBtn');
            
            // Use filtered invoices if filters are active
            const useFiltered = window.isFiltered && Array.isArray(window.filteredInvoiceNumbers) && window.filteredInvoiceNumbers.length > 0;
            const arr = useFiltered ? window.filteredInvoiceNumbers : (Array.isArray(window.uniqueInvoiceNumbers) ? window.uniqueInvoiceNumbers : []);
            
            if (!prevBtn || !nextBtn) return;
            if (arr.length === 0) {
                prevBtn.disabled = true; nextBtn.disabled = true; 
                prevBtn.title = 'No invoices' + (useFiltered ? ' matching filters' : ' in table'); 
                nextBtn.title = 'No invoices' + (useFiltered ? ' matching filters' : ' in table'); 
                return;
            }
            const idx = (typeof window.currentInvoiceIndex === 'number') ? window.currentInvoiceIndex : 0;
            prevBtn.disabled = !(idx > 0);
            nextBtn.disabled = !(idx < arr.length - 1);
            prevBtn.title = prevBtn.disabled ? 'Already at first invoice' : `Previous invoice - ${idx} of ${arr.length}`;
            nextBtn.title = nextBtn.disabled ? 'Already at last invoice' : `Next invoice - ${idx + 2} of ${arr.length}`;
        } catch (e) { console.error('updateInvoiceNavButtons error', e); }
    };
    // Ensure the exposed object has the latest method
    try { window.navigation.updateInvoiceNavButtons = NAV.updateInvoiceNavButtons; } catch (e) { /* ignore */ }
})();
