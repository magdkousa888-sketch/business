// Extracted add new invoice implementation
(function () {
    function parseInvRef(ref) {
        const s = String(ref || "").trim();
        const m = s.match(/^(\D*?)(\d+)(\D*)$/);
        if (!m) {
            return {
                prefix: "INV-",
                num: 0,
                pad: 7,
                suffix: ""
            };
        }
        return {
            prefix: m[1],
            num: parseInt(m[2], 10),
            pad: m[2].length,
            suffix: m[3] || ""
        };
    }

    function formatInvRef(prefix, num, pad, suffix) {
        const digits = String(Math.max(0, num)).padStart(pad, "0");
        return `${prefix}${digits}${suffix || ""}`;
    }

    function addNewInvoiceImpl() {
        // Activate the client section first
        if (typeof window.activateClientSection === 'function') {
            window.activateClientSection();
        }

        // Pull known state from globals if available
        const allInvoices = window.allInvoices || [];

        let highestRef = null;
        let maxNum = 0,
            padLen = 7,
            pref = "INV-",
            suf = "";

        // Check existing invoices in the table to find the highest number
        if (Array.isArray(allInvoices) && allInvoices.length > 0) {
            const lastEntry = allInvoices[allInvoices.length - 1];
            let lastRef = lastEntry["Invoice Number"];

            if (lastRef) {
                highestRef = lastRef;
                const parsed = parseInvRef(lastRef);
                maxNum = parsed.num;
                padLen = parsed.pad;
                pref = parsed.prefix;
                suf = parsed.suffix;
            }

            // Scan all invoices to find the highest number
            allInvoices.forEach((inv) => {
                let ref = inv["Invoice Number"];
                if (ref) {
                    const parsed = parseInvRef(ref);
                    if (parsed.num > maxNum) {
                        maxNum = parsed.num;
                        padLen = parsed.pad;
                        pref = parsed.prefix;
                        suf = parsed.suffix;
                        highestRef = ref;
                    }
                }
            });
        }

        // Generate the next invoice number
        const nextRef = formatInvRef(pref, maxNum > 0 ? maxNum + 1 : 1, padLen, suf);

        console.log('Generated new invoice number:', nextRef, 'from highest existing:', highestRef);

        // Get today's date in YYYY-MM-DD format for the date inputs
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayFormatted = `${yyyy}-${mm}-${dd}`;

        // Reset all fields for new invoice
        if (document.getElementById('invoiceNumber')) document.getElementById('invoiceNumber').value = nextRef;
        if (document.getElementById('invoiceDate')) document.getElementById('invoiceDate').value = todayFormatted;
        if (document.getElementById('dueDate')) document.getElementById('dueDate').value = todayFormatted;
        if (document.getElementById('terms')) document.getElementById('terms').value = "Due on Receipt";
        if (document.getElementById('termsLabel')) document.getElementById('termsLabel').textContent = 'Due on Receipt';
        if (document.getElementById('vatNo')) document.getElementById('vatNo').value = "";
        if (document.getElementById('clientNameDisplay')) document.getElementById('clientNameDisplay').textContent = "";
        if (document.getElementById('clientAddressDisplay')) document.getElementById('clientAddressDisplay').innerHTML = "";
        // Clear the separate country display element as well
        if (document.getElementById('clientCountryDisplay')) { document.getElementById('clientCountryDisplay').textContent = ''; document.getElementById('clientCountryDisplay').style.display = 'none'; }
        if (document.getElementById('clientTRNDisplay')) document.getElementById('clientTRNDisplay').textContent = "";
        if (document.getElementById('emirateDropdown')) {
            const ed = document.getElementById('emirateDropdown');
            try { ed.value = 'Dubai'; ed.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { ed.value = 'Dubai'; }
        }
        if (document.getElementById('vatTreatmentDropdown')) document.getElementById('vatTreatmentDropdown').value = "";
        if (document.getElementById('invoiceStatusDropdown')) {
            const s = document.getElementById('invoiceStatusDropdown');
            // Default new invoice status to Draft and prevent user from choosing Closed when creating
            s.value = "Draft";
            try { if (typeof window.setInvoiceStatusClosedAllowed === 'function') window.setInvoiceStatusClosedAllowed(false); } catch(e) {}
            // Ensure Closed isn't accidentally left selected
            if ((s.value || '').toString().trim() === 'Closed') s.value = 'Draft';
        }
        if (document.getElementById('projectCodeInput')) document.getElementById('projectCodeInput').value = "";
        if (document.getElementById('projectCode')) document.getElementById('projectCode').value = "";
        if (document.getElementById('projectCodeDisplay')) document.getElementById('projectCodeDisplay').textContent = "";
        if (document.getElementById('notesText')) document.getElementById('notesText').value = "";

        if (typeof window.updateInvoiceDisplayFields === 'function') window.updateInvoiceDisplayFields();

        const tbody = document.getElementById('itemsTable');
        if (tbody) tbody.innerHTML = "";
        if (typeof window.addRow === 'function') window.addRow();
        if (typeof window.calculateTotals === 'function') window.calculateTotals();

        // Always position at the last invoice (latest/newest) when creating a new invoice
        // This ensures navigation stays at the end of the list
        if (typeof window !== 'undefined') {
            const lastIndex = (window.uniqueInvoiceNumbers && window.uniqueInvoiceNumbers.length > 0) 
                ? window.uniqueInvoiceNumbers.length - 1 
                : -1;
            
            // Set both current and last index to the end of the list
            window.currentInvoiceIndex = lastIndex;
            window.lastInvoiceIndex = lastIndex;
            window.isNewInvoiceMode = true;  // Set flag for new invoice mode
            window.newInvoiceDirty = false;
            // When in new invoice mode, disallow Closed status selection
            try { if (typeof window.setInvoiceStatusClosedAllowed === 'function') window.setInvoiceStatusClosedAllowed(false); } catch(e) {}
            if (typeof window.updateInvoiceNavButtons === 'function') window.updateInvoiceNavButtons();
        }

        // Update button state
        if (typeof window.checkSaveButtonState === 'function') {
            window.checkSaveButtonState();
        }

        console.log('New invoice created:', nextRef, '- Navigation reset for new invoice');
    }

    // Expose implementation for the original file to delegate to
    window.addNewInvoiceImpl = addNewInvoiceImpl;
})();
