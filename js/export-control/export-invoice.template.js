/* Export Invoice: template helper */
(function () {
    window.ExportInvoice = window.ExportInvoice || {};
    window.ExportInvoice.template = `<div class="invoice-wrapper"  id="export-invoice-wrapper" hidden>
                <div class="invoice" id="export-invoice">
                    <div class="header" id="export-header">
                        <div class="company-info">
                            <img src="logo.png" alt="Company Logo" style="height: 70px; width: 180px; margin-bottom: 20px;">
                            <div class="company-name">IBS Consultancy L.L.C</div>
                            <div class="company-address">
                                Sheikh Zayed Rd, DIFC, Al Saqr Business Tower, 27th Floor -<br>
                                office 20, Dubai, UAE<br>
                                TRN 104220602700003
                            </div>
                            <div class="company-contact">
                                +971 4 272 0034<br>
                                info@ibs-mea.com

                            </div>
                        </div>
                        <div class="invoice-title">
                            <div class="tax-invoice">TAX INVOICE</div>
                            <div class="export-invoice-number"># <input type="text" id="invoiceNumber" class="export-invoice-number" value="INV-0000000" ></div>
                        </div>
                    </div>
                    <div class="invoice-details" id="export-invoice-details">
                        <div class="bill-to">
                            <div class="bill-to-label">Bill To</div>
                            <div class="bill-to-content">
                                <div class="client-name-display" id="clientNameDisplay">BAMX INVESTMENT LLC</div>
                                <div id="clientAddressDisplay">
                                    Office No. 1201, H Hotel & Office Tower S.P.V. Limited - First Trade Centre<br>
                                    Dubai<br>
                                    United Arab Emirates
                                </div>
                                <!-- Billing country parsed separately from Contacts: Billing Country -->
                                <div id="clientCountryDisplay" style="margin-top:4px; color: #333; font-size: 10px;"></div>
                                <div style="margin-top: 3px; font-size: 10px;" id="clientTRNDisplay">TRN 104331472100003</div>
                            </div>
                        </div>
                        <div class="invoice-meta" id="export-invoice-meta">
                            <div class="meta-row">
                                <span class="meta-label">Invoice Date :</span>
                                <span class="meta-value"><input type="date" id="invoiceDate" value="2025-10-03"></span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label" id="termsLabel">Terms :</span>
                                <span class="meta-value"><input type="text" id="terms" value="Due on Receipt"></span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Due Date :</span>
                                <span class="meta-value"><input type="date" id="dueDate" value="2025-10-03"></span>
                            </div>

                            <div class="meta-row">
                                <span class="meta-label">Project Code :</span>
                                <span class="meta-value"><input type="text" id="projectCode" value=""></span>
                            </div>
                        </div>
                    </div>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width:4%;">#</th>
                                <th style="width:38%;">Description</th>
                                <th style="width:6%;">Qty</th>
                                <th style="width:8%;">Rate</th>
                                <th style="width:8%;">Discount</th>
                                <th style="width:12%;">Taxable Amount</th>
                                <th style="width:12%;">Tax Amount</th>
                                <th style="width:8%;">Tax %</th>
                                <th style="width:14%;">Total</th>
                            </tr>
                        </thead>
                        <tbody id="itemsTable">
                            <!-- rows inserted via JS -->
                        </tbody>
                    </table>
                    <div class="totals">
                        <div class="totals-row">
                            <div class="totals-label">Sub Total</div>
                            <div class="totals-value" id="subtotal" style="text-align: center">0.00</div>
                        </div>
                        <div class="totals-row">
                            <div class="totals-label">Total Tax</div>
                            <div class="totals-value" id="totalTax" style="text-align: center">0.00</div>
                        </div>
                        <div class="totals-row grand-total">
                            <div class="totals-label">Total AED</div>
                            <div class="totals-value" id="grandTotal" style="text-align: center">0.00</div>
                        </div>
                    </div>
                
                    <div class="payment-details" id="export-payment-details">
                    <div class="export-payment-made">
                        <div>Payment made </div>
                        <div id="balanceDue">-</div>
                    </div>
                    <div class="export-remaining-balance">
                        <div>Balance Due </div>
                        <div id="remainingBalance">-</div>
                    </div>
                    </div>
                    <div class="notes">
                        <div class="notes-label">Notes</div>
                        <textarea id="notesText" class="export-notes-textarea">Thanks for your business.</textarea>
                    </div>
                    
                    <div class="bank-details">
                        <div class="bank-title">Bank Account Details</div>
                        <div class="bank-row">
                            <span class="bank-label">Bank Account Name:</span>
                            <span>I B S Consultancy LLC</span>
                        </div>
                        <div class="bank-row">
                            <span class="bank-label">Bank Name:</span>
                            <span>Emirates NBD</span>
                        </div>
                        <div class="bank-row">
                            <span class="bank-label">IBAN:</span>
                            <span>AE360260001015867786601</span>
                        </div>
                        <div class="bank-row">
                            <span class="bank-label">Account No:</span>
                            <span>1015867786601</span>
                        </div>
                        <div class="bank-row">
                            <span class="bank-label">Swift Code:</span>
                            <span>EBILAEAD</span>
                        </div>
                    </div>
                </div>
            </div>`;

    window.ExportInvoice.loadTemplateInto = function (divId) {
        var div = document.getElementById(divId);
        if (div) div.innerHTML = window.ExportInvoice.template;
    };
})();
