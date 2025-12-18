// expenses-modal.js — Expenses Manager modal (simple, three-section layout matching bundles modal)
(function(){
	'use strict';

	function openExpensesModal() {
		// Prevent double-open
		if (document.getElementById('expensesModalOverlay')) { console.warn('expenses-modal: open called but modal already present'); return; }
		// Overlay
		const overlay = document.createElement('div');
		overlay.className = 'modal-overlay';
		overlay.id = 'expensesModalOverlay';

		// Content
		const content = document.createElement('div');
		content.className = 'expense-modal-content';

		// Header
		const header = document.createElement('div');
		header.className = 'modal-header';
		header.innerHTML = `
			<h3>Expenses Manager</h3>
			<div class="header-controls">
				<button type="button" class="btn prev-btn" title="Previous">Prev</button>
				<button type="button" class="btn nav-index" aria-hidden="true">0 / 0</button>
				<button type="button" class="btn next-btn" title="Next">Next</button>
				<button class="modal-close" title="Close">&times;</button>
			</div>
		`;

		// Body (three sections: meta, items, actions)
		const body = document.createElement('div');
		body.className = 'expense-modal-body';
        body.innerHTML = `

		<div class="expenses-modal-sections">
		<div class="expense-form-actions">
                <div class="action-bar" hidden>
                    <button type="button" class="btn btn-danger" id="expensesDeleteBtn">Delete</button>
                </div>
                <div class="action-bar">
                    
					<button type="button" class="btn btn-append" id="expensesCloneBtn">Clone</button>
                    <button type="button" class="btn btn-success" id="expensesNewBtn">New</button>
					<button type="button" class="btn btn-append" id="expensesSaveBtn">Save</button>
                </div>
            </div>
            <div class="meta-section">
			
                <div class="form-grid">
                    <div><label>Expense Date</label><div><input type="date" id="expenseDate" class="bundle-input"></div></div>
                    <div><label>From Date</label><div><input type="date" id="expenseFromDate" class="bundle-input"></div></div>
					<div><label>To Date</label><div><input type="date" id="expenseToDate" class="bundle-input"></div></div>
					<div><label>Paid Through</label><div><select id="expensePaidThrough" class="bundle-input"></select></div></div>
                    <div><label>Vendor</label><div><select id="expenseVendor" class="bundle-input"><option value="">-- Select Vendor --</option></select></div></div>
                    <div><label>Project Name</label><div><select id="expenseProjectName" class="bundle-input"></select></div></div>
                    <div><label>VAT Treatment</label><div><select id="expenseVatTreatment" class="bundle-input"></select></div></div>
                    <div><label>Place Of Supply</label><div><select id="expensePlaceOfSupply" class="bundle-input"></select></div></div>
                    <div><label>Is Inclusive Tax</label><div><select id="expenseIsInclusiveTax" class="bundle-input"><option value="True">True</option><option value="False">False</option></select></div></div>
                    <div><label>Expense Type</label><div><select id="expenseType" class="bundle-input"><option value="Service">Service</option><option value="Product">Product</option></select></div></div>
                    <div><label>Reference#</label><div><input type="text" id="expenseReference" class="bundle-input"></div></div>
                    <div>
                        <label>Attachments</label>
                        <div>
                            <input type="file" id="expenseAttachments" class="bundle-input" multiple>
                            <ul id="expenseAttachmentsList" class="attachments-list"></ul>
                        </div>
                    </div>
                </div>
                <div id="expensesSaveStatus" class="bundles-save-status"></div>

                <!-- Diagnostics panel (hidden by default) -->

            </div>

            <div class="items-section table-scroll" style="margin-top:12px;">
                <h4 class="expenses-items-heading">Items</h4>
                <div id="expensesEmptyMsg" class="expenses-empty">No items yet — click "Add Item" to add an expense.</div>
                <table class="expense-items-table" id="expensesItemsTable">
                    <thead>
                        <tr>
                            <th style="width:34%">Description</th>
                            <th style="width:18%">Account</th>
                            <th style="width:12%">Amount</th>
                            <th style="width:12%">Tax</th>
                            <th style="width:12%">Total</th>
                            <th style="width:14%">Ref</th>
                            <th style="width:4%"></th>
                        </tr>
                    </thead>
                    <tbody id="expensesItemsBody"></tbody>
                </table>
                <div class="table-actions">
                    <div><button type="button" class="btn add-line-btn" id="expenses_addItem">Add Item</button></div>
                    <div class="grand-total">Grand Total: <span id="expensesGrandTotal">0.00</span></div>
                </div>
                <div class="notes-row">
                    <label>Notes</label>
                    <input type="text" id="expensesNotes" class="bundle-input" placeholder="Notes (optional)">
                </div>
            </div>

            
            </div>
        `;

        // Multi-file attachment preview logic
        const attachmentsInput = document.getElementById('expenseAttachments');
        const attachmentsList = document.getElementById('expenseAttachmentsList');
        if (attachmentsInput && attachmentsList) {
            attachmentsInput.addEventListener('change', function() {
                attachmentsList.innerHTML = '';
                Array.from(attachmentsInput.files).forEach(file => {
                    const li = document.createElement('li');
                    li.textContent = file.name;
                    attachmentsList.appendChild(li);
                });
            });
        }

		content.appendChild(header);
		content.appendChild(body);
		overlay.appendChild(content);
		document.body.appendChild(overlay);
		document.body.style.overflow = 'hidden';

		// References
		const closeBtn = header.querySelector('.modal-close');
		const addItemBtn = document.getElementById('expenses_addItem');
		const saveBtn = document.getElementById('expensesSaveBtn');
		const newBtn = document.getElementById('expensesNewBtn');
		const deleteBtn = document.getElementById('expensesDeleteBtn');
		/*const cancelBtn = document.getElementById('cancelExpensesBtn');*/
		const itemsBody = document.getElementById('expensesItemsBody');
		const emptyMsg = document.getElementById('expensesEmptyMsg');

		function closeExpensesModal() { const o = document.getElementById('expensesModalOverlay'); if (o) { o.remove(); document.body.style.overflow = ''; } }
		closeBtn.onclick = closeExpensesModal;
		/*cancelBtn.onclick = closeExpensesModal;*/

		// Utilities
		function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

		// Event delegation for remove buttons (robust for dynamically-added rows)
		if (typeof window !== 'undefined') {
			itemsBody.addEventListener('click', function(e){
				const btn = e.target.closest && e.target.closest('.remove-btn');
				if (!btn) return;
				console.log('expenses-modal: remove button clicked');
				const r = btn.closest('tr'); if (r) { r.remove(); updateGrandTotal(); }
			});
		}

		function updateRowTotal(row){
			const amt = parseFloat((row.querySelector('.item-amount')||{}).value) || 0;
			const tax = parseFloat((row.querySelector('.item-tax')||{}).value) || 0;
			const total = Number(amt + tax).toFixed(2);
			const totEl = row.querySelector('.item-total'); if (totEl) totEl.textContent = total;
			updateGrandTotal();
		}

		function updateGrandTotal(){
			const rows = Array.from(itemsBody.querySelectorAll('tr'));
			let g = 0;
			rows.forEach(r => { const t = parseFloat((r.querySelector('.item-total')||{}).textContent) || 0; g += t; });
			const grand = document.getElementById('expensesGrandTotal'); if (grand) grand.textContent = Number(g).toFixed(2);
			if (emptyMsg) emptyMsg.style.display = rows.length ? 'none' : 'block';
		}

		function createItemRow(data){
			const d = data || {};
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td><input class="expense-item-desc" value="${escapeHtml(d.description||'')}" placeholder="Description"></td>
				<td><select class="expense-item-account"></select></td>
				<td><input class="item-amount" type="number" step="any" value="${Number(d.amount||0).toFixed(2)}"></td>
				<td><input class="item-tax" type="number" step="any" value="${Number(d.tax||0).toFixed(2)}"></td>
				<td><div class="item-total">${Number(d.total||0).toFixed(2)}</div></td>
			<td><input class="item-ref" type="text" value="${escapeHtml(d.reference||'')}"></td>
			<td class="actions-col"><button type="button" class="remove-btn" title="Remove item">X</button></td>
			`;

			// populate account select from global window.expenseAccounts if present
			const accSel = tr.querySelector('.expense-item-account');
			if (Array.isArray(window.expenseAccounts) && window.expenseAccounts.length) {
				accSel.innerHTML = '<option value="">-- Select Account --</option>' + window.expenseAccounts.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
				if (d.account) accSel.value = d.account;
			} else {
				accSel.innerHTML = '<option value="">-- Select Account --</option>';
			}

			const amtIn = tr.querySelector('.item-amount');
			const taxIn = tr.querySelector('.item-tax');
			amtIn.addEventListener('input', () => updateRowTotal(tr));
			taxIn.addEventListener('input', () => updateRowTotal(tr));

			// remove on double click of description (simple UX) — user can ask to change
			const desc = tr.querySelector('.expense-item-desc');
			desc.addEventListener('dblclick', () => { tr.remove(); updateGrandTotal(); });

			return tr;
		}

		// Add item
		if (addItemBtn) addItemBtn.onclick = () => {
			const row = createItemRow({});
			itemsBody.appendChild(row);
			updateRowTotal(row);
			// focus the desc input
			const d = row.querySelector('.expense-item-desc'); if (d) setTimeout(()=>d.focus(),50);
		};

		// New: clear form and create a single empty item ready for entry
		if (newBtn) newBtn.onclick = () => {
			document.getElementById('expenseDate').value = '';
			document.getElementById('expensePaidThrough').value = '';
			document.getElementById('expenseVendor').value = '';
			document.getElementById('expenseProjectName').value = '';
			document.getElementById('expenseVatTreatment').value = '';
			document.getElementById('expensePlaceOfSupply').value = '';
			document.getElementById('expenseIsInclusiveTax').value = 'False';
			document.getElementById('expenseType').value = 'Service';
			document.getElementById('expenseReference').value = '';
			document.getElementById('expensesNotes').value = '';
			// reset items and add one blank row for quick entry
			itemsBody.innerHTML = '';
			const newRow = createItemRow({});
			itemsBody.appendChild(newRow);
			updateRowTotal(newRow);
			// focus the description input so user can begin typing immediately
			const d2 = newRow.querySelector('.expense-item-desc'); if (d2) setTimeout(()=>d2.focus(),50);
			updateGrandTotal();
			const status = document.getElementById('expensesSaveStatus'); if (status) { status.textContent = 'New expense ready'; setTimeout(()=>status.textContent='',2000); }
		};

		// Save
		if (saveBtn) saveBtn.onclick = async () => {
			try {
				const rows = Array.from(itemsBody.querySelectorAll('tr'));
				const items = rows.map(r => ({
					description: (r.querySelector('.expense-item-desc')||{}).value || '',
					account: (r.querySelector('.expense-item-account')||{}).value || '',
					amount: parseFloat((r.querySelector('.item-amount')||{}).value) || 0,
					tax: parseFloat((r.querySelector('.item-tax')||{}).value) || 0,
					total: parseFloat((r.querySelector('.item-total')||{}).textContent) || 0,
					reference: (r.querySelector('.item-ref')||{}).value || ''
				}));

				const payload = {
					date: document.getElementById('expenseDate').value || '',
					paidThrough: document.getElementById('expensePaidThrough').value || '',
					vendor: document.getElementById('expenseVendor').value || '',
					project: document.getElementById('expenseProjectName').value || '',
					vatTreatment: document.getElementById('expenseVatTreatment').value || '',
					placeOfSupply: document.getElementById('expensePlaceOfSupply').value || '',
					isInclusive: document.getElementById('expenseIsInclusiveTax').value || '',
					type: document.getElementById('expenseType').value || '',
					reference: document.getElementById('expenseReference').value || '',
					notes: document.getElementById('expensesNotes').value || '',
					items: items
				};
				console.log('EXPENSES SAVE PAYLOAD', payload);
					const status = document.getElementById('expensesSaveStatus');
					try {
						if (status) status.textContent = '⏳ Saving...';
						saveBtn.disabled = true;
						// Call the append function which will attempt server->service-account->oauth fallbacks
						const res = await (window.appendExpensesToGoogleSheets ? window.appendExpensesToGoogleSheets(payload, status) : Promise.resolve({ ok: false, error: 'Append function not available' }));
						if (res && res.ok) {
							if (status) status.textContent = `✅ Appended ${res.rowsAppended || (payload.items && payload.items.length) || 0} row(s)`;
							setTimeout(()=>{ if (status) status.textContent = ''; }, 3000);
						} else {
							console.warn('Expenses append returned error', res);
							if (status) status.textContent = `⚠️ ${res && res.error ? String(res.error) : 'Append failed'}`;
						}
					} catch (err) {
						console.error('expenses save append error', err);
						if (status) status.textContent = `⚠️ ${err && err.message ? err.message : 'Save failed'}`;
					} finally {
						saveBtn.disabled = false;
					}
			} catch (e) { console.warn('expenses save failed', e); const status = document.getElementById('expensesSaveStatus'); if (status) status.textContent = 'Save failed'; }
			document.getElementById('expenseVendor').value = '';
			document.getElementById('expenseProjectName').value = '';
			document.getElementById('expenseVatTreatment').value = '';
			document.getElementById('expensePlaceOfSupply').value = '';
			document.getElementById('expenseIsInclusiveTax').value = 'False';
			document.getElementById('expenseType').value = 'Service';
			document.getElementById('expenseReference').value = '';
			document.getElementById('expensesNotes').value = '';
			itemsBody.innerHTML = '';
			updateGrandTotal();
		};

		// Delete: clear items only
		if (deleteBtn) deleteBtn.onclick = () => { itemsBody.innerHTML = ''; updateGrandTotal(); const status = document.getElementById('expensesSaveStatus'); if (status) { status.textContent = 'Items cleared'; setTimeout(()=>status.textContent='',2000); } };

		// Attempt to load payment methods from Google Sheets when modal is shown
		try {
			const paidSelect = document.getElementById('expensePaidThrough');
			if (paidSelect && window.expensesLoader && typeof window.expensesLoader.loadPaymentMethodsIntoSelect === 'function') {
				console.log('expenses-modal: invoking loader for PaidThrough select');
				window.expensesLoader.loadPaymentMethodsIntoSelect(paidSelect, { sheetId: '1PLxaoFIZC4LEqFf7kJI1tQNOrGfFsEOjn6kt3QB30HU', range: 'Payment methods!A2:C200', columnIndex: 2, statusEl: document.getElementById('expensesSaveStatus') })
					.then(uniq => console.log('expenses-modal: loader returned', uniq && uniq.length ? uniq.length : 0, 'items'))
					.catch(e => console.warn('expenses-modal: loadPaymentMethods failed', e));
			} else {
				console.log('expenses-modal: paidSelect or loader not available', !!paidSelect, !!window.expensesLoader);
			}
		} catch (e) { console.warn('expenses-modal: load payment methods error', e); }

		// Load Projects into Project Name select (column 2 from Projects sheet)
		try {
			const projSelect = document.getElementById('expenseProjectName');
			if (projSelect && window.expensesLoader && typeof window.expensesLoader.loadColumnIntoSelect === 'function') {
				console.log('expenses-modal: invoking loader for Project select');
				window.expensesLoader.loadColumnIntoSelect(projSelect, { sheetId: '1PLxaoFIZC4LEqFf7kJI1tQNOrGfFsEOjn6kt3QB30HU', range: 'Projects!A2:F200', columnIndex: 2, statusEl: document.getElementById('expensesSaveStatus'), placeholder: '-- Select Project --' })
					.then(uniq => console.log('expenses-modal: project loader returned', uniq && uniq.length ? uniq.length : 0, 'items'))
					.catch(e => console.warn('expenses-modal: loadProjects failed', e));
			} else {
				console.log('expenses-modal: projSelect or loader not available', !!projSelect, !!window.expensesLoader);
			}
		} catch (e) { console.warn('expenses-modal: load projects error', e); }

		// Load Expense Accounts into per-row account selects (column 2 from Expense Accounts sheet)
		try {
			console.log('expenses-modal: invoking loader for Accounts');
			if (window.expensesLoader && typeof window.expensesLoader.loadColumnIntoSelect === 'function') {
				const tmpSel = document.createElement('select');
				window.expensesLoader.loadColumnIntoSelect(tmpSel, { sheetId: '1PLxaoFIZC4LEqFf7kJI1tQNOrGfFsEOjn6kt3QB30HU', range: 'Expense Accounts!A2:F200', columnIndex: 2, statusEl: document.getElementById('expensesSaveStatus'), placeholder: '-- Select Account --' })
					.then(uniq => {
						console.log('expenses-modal: accounts loader returned', uniq && uniq.length ? uniq.length : 0, 'items');
						window.expenseAccounts = uniq || [];
						// populate any existing rows
						document.querySelectorAll('.expense-item-account').forEach(sel => {
							sel.innerHTML = '<option value="">-- Select Account --</option>' + (uniq || []).map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
						});
					})
					.catch(e => console.warn('expenses-modal: loadAccounts failed', e));
			} else {
				console.log('expenses-modal: accounts loader not available', !!window.expensesLoader);
			}
		} catch (e) { console.warn('expenses-modal: load accounts error', e); }

		// Load Vendors into vendor select (column 3 from Vendors sheet)
		try {
			const vendorSel = document.getElementById('expenseVendor');
			if (vendorSel && window.expensesLoader && typeof window.expensesLoader.loadColumnIntoSelect === 'function') {
				console.log('expenses-modal: invoking loader for Vendors');
				window.expensesLoader.loadColumnIntoSelect(vendorSel, { sheetId: '1PLxaoFIZC4LEqFf7kJI1tQNOrGfFsEOjn6kt3QB30HU', range: 'Vendors!A2:L200', columnIndex: 3, statusEl: document.getElementById('expensesSaveStatus'), placeholder: '-- Select Vendor --' })
					.then(uniq => {
						console.log('expenses-modal: vendors loader returned', uniq && uniq.length ? uniq.length : 0, 'items');
						window.expenseVendors = uniq || [];
					})
					.catch(e => console.warn('expenses-modal: loadVendors failed', e));
			} else {
				console.log('expenses-modal: vendorSel or loader not available', !!vendorSel, !!window.expensesLoader);
			}
		} catch (e) { console.warn('expenses-modal: load vendors error', e); }

		// Inject VAT Treatment options (value -> user label)
		try {
			const vatSel = document.getElementById('expenseVatTreatment');
			if (vatSel) {
				const vatOptions = [
					{ value: 'vat_registered', label: 'VAT Registered' },
					{ value: 'gcc_non_vat', label: 'GCC None Vat' },
					{ value: 'vat_non_registered', label: 'VAT Not Registred' },
					{ value: 'out_of_scope', label: 'Out of Scope' },
					{ value: 'non_vat', label: 'None VAT' }
				];
				vatSel.innerHTML = vatOptions.map(o => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
				console.log('expenses-modal: injected VAT treatment options', vatOptions.map(o=>o.value));
			} else {
				console.log('expenses-modal: vat select not found');
			}
		} catch (e) { console.warn('expenses-modal: inject vat options failed', e); }

		// Populate Place Of Supply from main emirateDropdown
		try {
			const mainPlace = document.getElementById('emirateDropdown');
			const placeSel = document.getElementById('expensePlaceOfSupply');
			if (placeSel) {
				placeSel.innerHTML = '';
				if (mainPlace && mainPlace.options && mainPlace.options.length) {
					Array.from(mainPlace.options).forEach(o => placeSel.appendChild(o.cloneNode(true)));
					console.log('expenses-modal: cloned emirate options into expensePlaceOfSupply, count=', placeSel.options.length);
				} else {
					console.log('expenses-modal: emirateDropdown not found - inserting placeholder');
					placeSel.innerHTML = '<option value="">-- Select Place Of Supply --</option>';
				}
			} else {
				console.log('expenses-modal: expensePlaceOfSupply select not found');
			}
		} catch (e) { console.warn('expenses-modal: clone place of supply failed', e); }
			// Wiring: Diagnostics UI
			try {
				const diagBtn = document.getElementById('expensesDiagBtn');
				const diagPanel = document.getElementById('expensesDiagnostics');
				const saEmailEl = document.getElementById('expensesDiagSaEmail');
				const copyBtn = document.getElementById('expensesDiagCopyBtn');
				const pingBtn = document.getElementById('expensesDiagPingBtn');
				const pingResult = document.getElementById('expensesDiagPingResult');
				const testBtn = document.getElementById('expensesDiagTestBtn');



				// Wire buttons
				if (diagBtn) diagBtn.onclick = async () => {
					if (diagPanel.style.display === 'none' || !diagPanel.style.display) {
						diagPanel.style.display = 'block';
						await loadServiceAccountEmail();
					} else { diagPanel.style.display = 'none'; }
				};
				if (copyBtn) copyBtn.onclick = () => { const t = saEmailEl.textContent || ''; navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(t).then(()=>alert('Service account email copied')); };
				if (pingBtn) pingBtn.onclick = async () => {
					// Ping endpoints to check server and CORS
					try {
						pingBtn.disabled = true; pingResult.textContent = '⏳ pinging...';
						const endpoints = ['http://127.0.0.1:3001/api/ping','/api/ping'];
						let out = [];
						for (const ep of endpoints) {
							try {
								const r = await fetch(ep, { method: 'GET' });
								const j = await r.json().catch(()=>null);
								out.push(`${ep} -> ${r.status}` + (j ? ` ${JSON.stringify(j)}` : ''));
							} catch (e) {
								out.push(`${ep} -> ERROR (${e && e.message ? e.message : e})`);
							}
						}
						pingResult.textContent = out.join(' | ');
					} catch (e) {
						pingResult.textContent = `Error: ${e && e.message ? e.message : e}`;
					} finally { pingBtn.disabled = false; }
				};
				if (testBtn) testBtn.onclick = async () => {
					const statusEl = document.getElementById('expensesSaveStatus');
					try {
						if (testBtn) testBtn.disabled = true; if (statusEl) statusEl.textContent = '⏳ Testing append via server...';
						const rows = [[`DIAG ${Date.now()}`, new Date().toISOString(), 'Diagnostics append test']];

						// Try endpoints in order: same-origin serverless, local append server, other configured endpoint
						const endpoints = [
							'/api/append-expenses',
							'http://127.0.0.1:3001/api/append-expenses',
							window.APPEND_API_URL || null
						].filter(Boolean);

						let lastErr = null; let lastJson = null; let lastEndpoint = null;
						for (const ep of endpoints) {
							try {
								if (statusEl) statusEl.textContent = `⏳ Testing ${ep} ...`;
								console.log('expenses-modal: testing append endpoint', ep);
								const resp = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows, sheetName: 'Expenses', range: 'A1', spreadsheetId: window.GOOGLE_SPREADSHEET_ID || undefined }) });
								let j = null;
								try { j = await resp.json(); } catch(e){ j = null; }
								if (resp.ok && j && j.ok) {
									if (statusEl) statusEl.textContent = `✅ Test append succeeded via ${ep}`;
									alert('Test append succeeded — check the Expenses sheet');
									return;
								}
								const errMsg = j && j.error ? j.error : `Server append failed (${resp.status})`;
								console.warn('Server test append failed at', ep, errMsg);
								lastErr = errMsg; lastJson = j; lastEndpoint = ep;
								// If 404 specifically, continue to next endpoint; otherwise break and try fallback
								if (resp.status === 404) { continue; }
								break;
							} catch (err) {
								console.warn('Server test append request failed at', ep, err);
								lastErr = err && err.message ? err.message : String(err);
								// try next endpoint
								continue;
							}
						}
				// If server provided sheet titles, surface UI to try alternate sheets
				if (lastJson && Array.isArray(lastJson.sheetTitles) && lastJson.sheetTitles.length) {
					console.log('expenses-modal: server returned sheetTitles. Rendering choices', lastJson.sheetTitles);
					renderSheetChoices(lastJson.sheetTitles, rows, lastEndpoint || '/api/append-expenses');
					if (statusEl) statusEl.textContent = '⚠️ Server suggests different sheet titles — choose one below to retry';
					if (testBtn) testBtn.disabled = false;
					return;
				}
						// If we get here, all endpoints failed — attempt Service Account fallback
						if (window.ServiceAccountAuth && typeof window.ServiceAccountAuth.fetch === 'function') {
							try {
								if (statusEl) statusEl.textContent = '⏳ Trying service-account append as fallback...';
								const url = `https://sheets.googleapis.com/v4/spreadsheets/${window.GOOGLE_SPREADSHEET_ID || ''}/values:append?range=${encodeURIComponent('Expenses!A1')}&valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
								console.log('expenses-modal: trying service-account append', url);
								const resp2 = await window.ServiceAccountAuth.fetch(url, { method: 'POST', body: JSON.stringify({ values: rows }) });
								if (!resp2.ok) {
									const txt = await resp2.text().catch(()=>null);
									throw new Error(txt || `Service account append failed (${resp2.status})`);
								}
								if (statusEl) statusEl.textContent = `✅ Test append succeeded (service account)`;
								alert('Test append succeeded via service account — check the Expenses sheet');
								return;
							} catch (saErr) {
								console.warn('Service account fallback failed', saErr);
								lastErr = saErr && saErr.message ? saErr.message : String(saErr);
								if (statusEl) statusEl.textContent = `⚠️ ${lastErr}`;
							}
						}

						alert('Test append failed: ' + (lastErr || 'Unknown error') + '\nCheck console for details');
					} catch (e) {
						console.warn('Test append error', e);
						if (statusEl) statusEl.textContent = `⚠️ ${e && e.message ? e.message : 'Test failed'}`;
					} finally { if (testBtn) testBtn.disabled = false; }
				};
			} catch(e) { console.warn('expenses-modal: wiring diagnostics failed', e); }
		// Attempt to load grouped Expenses and render into modal
		try {
			if (window.expensesBulkLoader && typeof window.expensesBulkLoader.loadAndRenderExpenses === 'function') {
				console.log('expenses-modal: invoking expensesBulkLoader.loadAndRenderExpenses');
				window.expensesBulkLoader.loadAndRenderExpenses({ sheetId: '1PLxaoFIZC4LEqFf7kJI1tQNOrGfFsEOjn6kt3QB30HU', range: 'Expenses!A2:AQ500', statusEl: document.getElementById('expensesSaveStatus') })
					.then(g => console.log('expenses-modal: expenses groups loaded', g && g.length ? g.length : 0))
					.catch(e => console.warn('expenses-modal: loadAndRenderExpenses failed', e));
			}
		} catch(e) { console.warn('expenses-modal: load grouped expenses error', e); }

		// initial empty state
		updateGrandTotal();
	}

	// Expose opener
	window.openExpensesManager = function(){ openExpensesModal(); };

})();
