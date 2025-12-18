// client_report_export.js — Export client report to PDF with summary header
(function() {
  'use strict';

  /**
   * Exports the unpaid invoices report table to PDF
   */
  async function exportUnpaidInvoicesReport() {
    try {
      // Get the report data from the table
      const tbody = document.getElementById('reportsResultsTBody');
      const tfoot = document.getElementById('reportsResultsTFoot');
      
      if (!tbody) {
        alert('No report data to export');
        return;
      }

      // Collect all invoice rows (skip detail rows that have class 'reports-details')
      const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => !row.classList.contains('reports-details'));
      const invoices = rows.map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 9) return null;
        
        // Extract text content, handling nested elements like buttons
        const getTextContent = (cell) => {
          if (!cell) return '';
          // Clone the cell and remove any buttons or action elements
          const clone = cell.cloneNode(true);
          const buttons = clone.querySelectorAll('button, .btn');
          buttons.forEach(btn => btn.remove());
          return clone.textContent.trim();
        };
        
        return {
          client: getTextContent(cells[1]) || '',
          invoiceNumber: getTextContent(cells[2]) || '',
          total: parseFloat(getTextContent(cells[3]).replace(/[^0-9.-]/g, '')) || 0,
          invoiceDate: getTextContent(cells[4]) || '',
          dueDate: getTextContent(cells[5]) || '',
          status: getTextContent(cells[6]) || '',
          paid: parseFloat(getTextContent(cells[7]).replace(/[^0-9.-]/g, '')) || 0,
          outstanding: parseFloat(getTextContent(cells[8]).replace(/[^0-9.-]/g, '')) || 0
        };
      }).filter(Boolean);

      if (invoices.length === 0) {
        alert('No invoices to export');
        return;
      }

      // Calculate summary statistics
      const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
      const totalInvoices = invoices.length;
      
      // Count unique clients and invoices per client
      const clientStats = {};
      invoices.forEach(inv => {
        if (!clientStats[inv.client]) {
          clientStats[inv.client] = { count: 0, outstanding: 0 };
        }
        clientStats[inv.client].count++;
        clientStats[inv.client].outstanding += inv.outstanding;
      });
      
      const uniqueClients = Object.keys(clientStats).length;
      const currentDate = new Date().toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Get totals from footer
      const totalCell = document.getElementById('reports_total');
      const paidCell = document.getElementById('reports_paid');
      const outstandingCell = document.getElementById('reports_outstanding');
      
      const footerTotal = totalCell ? totalCell.textContent.trim() : '0.00';
      const footerPaid = paidCell ? paidCell.textContent.trim() : '0.00';
      const footerOutstanding = outstandingCell ? outstandingCell.textContent.trim() : '0.00';

      // Get selected client from dropdown
      const clientSelect = document.getElementById('reportsClientSelect');
      const selectedClient = clientSelect && clientSelect.value ? clientSelect.value : 'All Clients';

      // Create PDF content
      const content = createPDFContent(invoices, clientStats, {
        currentDate,
        totalOutstanding,
        totalInvoices,
        uniqueClients,
        footerTotal,
        footerPaid,
        footerOutstanding,
        selectedClient
      });

      // Generate PDF
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Outstanding_Invoices_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

          // Helper: compute content height of report for dynamic sizing (prevents clipping)
          function computeContentHeight(rootEl) {
            try {
              const rect = rootEl.getBoundingClientRect();
              const top = rect.top;
              let bottom = rect.bottom;
              const selectors = ['.pdf-export-header', '.pdf-summary-table', '.pdf-client-summary-table', '.pdf-detail-table', '.pdf-section-title'];
              selectors.forEach(sel => {
                const node = rootEl.querySelector(sel);
                if (node) {
                  const r = node.getBoundingClientRect();
                  if (r.height > 0) bottom = Math.max(bottom, r.bottom);
                }
              });
              const contentHeight = Math.max(0, bottom - top);
              return Math.ceil(contentHeight || rootEl.scrollHeight || 0);
            } catch (e) {
              return rootEl.scrollHeight || 0;
            }
          }

      // Show loading indicator
      const exportBtn = document.getElementById('unpaidInvoicesExport');
      const originalText = exportBtn ? exportBtn.textContent : 'Export';
      if (exportBtn) {
        exportBtn.textContent = 'Generating PDF...';
        exportBtn.disabled = true;
      }

      // Append content to a temporary container to measure and avoid clipping in PDF render
      const tempContainer = document.createElement('div');
      tempContainer.className = 'export-temp-container';
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '0';
      tempContainer.style.top = '0';
      tempContainer.style.zIndex = '99999';
      tempContainer.style.background = '#fff';
      tempContainer.style.pointerEvents = 'none';
      tempContainer.style.overflow = 'visible';
      try {
        tempContainer.appendChild(content);
        document.body.appendChild(tempContainer);
        // compute height and set html2canvas height to avoid content clipping
        const contentHeight = computeContentHeight(content) || content.scrollHeight || content.offsetHeight || 1100;
        // Reduce buffer to avoid adding an extra blank page in the generated PDF.
        // Small trim helps avoid off-by-few-pixels rounding that creates an empty page.
        const buffer = 20; // previously 80
        const pageLimitPx = (opt.jsPDF && opt.jsPDF.format && opt.jsPDF.format === 'a4') ? (297 * (96/25.4)) : (1100);
        const extraTrim = 2;
        let forcedHeight = Math.min(contentHeight + buffer, pageLimitPx);
        forcedHeight = Math.max(100, Math.floor(forcedHeight - extraTrim));
        if (!opt.html2canvas) opt.html2canvas = {};
        opt.html2canvas.height = forcedHeight;
        opt.html2canvas.windowHeight = Math.max(forcedHeight, window.innerHeight || forcedHeight);
      } catch (e) {
        console.warn('Failed to append temp container for measurement', e);
      }

      try {
        // Ensure embedded images (logo) are loaded before rendering to PDF
        if (window.ExportInvoice && typeof window.ExportInvoice.waitForImages === 'function') {
          await window.ExportInvoice.waitForImages(content, 4000);
        }
        await html2pdf().set(opt).from(content).save();
      } finally {
        // cleanup temp container and re-enable button
        try { if (tempContainer && tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer); } catch (e) {}
      }

      // Reset button
      if (exportBtn) {
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
      }

      console.log('✅ Report exported successfully');

    } catch (error) {
      console.error('Failed to export report:', error);
      alert('Failed to export report: ' + (error.message || error));
      
      // Reset button on error
      const exportBtn = document.getElementById('unpaidInvoicesExport');
      if (exportBtn) {
        exportBtn.textContent = 'Export';
        exportBtn.disabled = false;
      }
    }
  }

  /**
   * Formats a number with thousand separators and 2 decimal places
   */
  function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Loads the CSS for PDF export
   */
  function loadExportCSS() {
    const link1 = document.createElement('link');
    link1.rel = 'stylesheet';
    link1.href = 'css/export-control/report-export.css';
    document.head.appendChild(link1);
    // client-specific report export CSS
    try {
      const link2 = document.createElement('link');
      link2.rel = 'stylesheet';
      link2.href = 'css/report-control/client-report-export.css';
      document.head.appendChild(link2);
    } catch (e) { /* noop if file missing */ }
  }

  /**
   * Creates HTML content for PDF export
   */
  function createPDFContent(invoices, clientStats, summary) {
    // Ensure CSS is loaded
    loadExportCSS();

    const container = document.createElement('div');
    container.className = 'pdf-export-container';

    // Header (include company logo and address)
    const header = document.createElement('div');
    header.className = 'pdf-export-header';
    header.innerHTML = `
      <div class="company-info">
        <img src="logo.png" alt="Company Logo" style="height: 70px; width: 180px; margin-bottom: 6px;">
        <div class="company-name">IBS Consultancy L.L.C</div>
        <div class="company-address">
          Sheikh Zayed Rd, DIFC, Al Saqr Business Tower, 27th Floor -<br>
          office 20, Dubai, UAE<br>
          TRN 104220602700003
        </div>
      </div>
      <div class="report-meta">
        <h1 class="pdf-export-title">Outstanding Invoices Report</h1>
        <div class="pdf-export-meta">Generated on ${summary.currentDate} | Currency: AED</div>
        <div class="pdf-export-meta-client">Client: ${summary.selectedClient}</div>
      </div>
    `;
    container.appendChild(header);

    // Summary Table
    const summaryTable = document.createElement('table');
    summaryTable.className = 'pdf-summary-table';
    summaryTable.innerHTML = `
      <thead>
        <tr>
          <th>Date of Export</th>
          <th class="align-right">Total Outstanding</th>
          <th class="align-center">Count of Clients</th>
          <th class="align-center">Total Invoices</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${summary.currentDate}</td>
          <td class="align-right font-bold">${formatCurrency(summary.footerOutstanding.replace(/[^0-9.-]/g, ''))}</td>
          <td class="align-center">${summary.uniqueClients}</td>
          <td class="align-center">${summary.totalInvoices}</td>
        </tr>
      </tbody>
    `;
    container.appendChild(summaryTable);

    // Client Summary Section
    const clientSummaryTitle = document.createElement('h2');
    clientSummaryTitle.className = 'pdf-section-title';
    clientSummaryTitle.textContent = 'Summary by Client';
    container.appendChild(clientSummaryTitle);

    const clientSummaryTable = document.createElement('table');
    clientSummaryTable.className = 'pdf-client-summary-table';
    
    let clientSummaryHTML = `
      <thead>
        <tr>
          <th>Client Name</th>
          <th class="align-center">Number of Invoices</th>
          <th class="align-right">Total Outstanding</th>
        </tr>
      </thead>
      <tbody>
    `;

    Object.keys(clientStats).sort().forEach(clientName => {
      const stats = clientStats[clientName];
      clientSummaryHTML += `
        <tr>
          <td>${clientName}</td>
          <td class="align-center">${stats.count}</td>
          <td class="align-right">${formatCurrency(stats.outstanding)}</td>
        </tr>
      `;
    });

    clientSummaryHTML += `
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td class="align-center">${summary.totalInvoices}</td>
          <td class="align-right">${formatCurrency(summary.footerOutstanding.replace(/[^0-9.-]/g, ''))}</td>
        </tr>
      </tfoot>
    `;

    clientSummaryTable.innerHTML = clientSummaryHTML;
    container.appendChild(clientSummaryTable);

    // Detailed Invoices Section
    const detailTitle = document.createElement('h2');
    detailTitle.className = 'pdf-section-title';
    detailTitle.textContent = 'Detailed Invoice List';
    container.appendChild(detailTitle);

    const detailTable = document.createElement('table');
    detailTable.className = 'pdf-detail-table';
    
    let detailHTML = `
      <thead>
        <tr>
          <th>Client</th>
          <th>Invoice #</th>
          <th class="align-right">Total</th>
          <th>Invoice Date</th>
          <th>Due Date</th>
          <th>Status</th>
          <th class="align-right">Paid</th>
          <th class="align-right">Outstanding</th>
        </tr>
      </thead>
      <tbody>
    `;

    invoices.forEach(inv => {
      detailHTML += `
        <tr>
          <td>${inv.client}</td>
          <td>${inv.invoiceNumber}</td>
          <td class="align-right">${formatCurrency(inv.total)}</td>
          <td>${inv.invoiceDate}</td>
          <td>${inv.dueDate}</td>
          <td>${inv.status}</td>
          <td class="align-right">${formatCurrency(inv.paid)}</td>
          <td class="align-right">${formatCurrency(inv.outstanding)}</td>
        </tr>
      `;
    });

    detailHTML += `
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total</td>
          <td class="align-right">${formatCurrency(summary.footerTotal.replace(/[^0-9.-]/g, ''))}</td>
          <td colspan="3"></td>
          <td class="align-right">${formatCurrency(summary.footerPaid.replace(/[^0-9.-]/g, ''))}</td>
          <td class="align-right">${formatCurrency(summary.footerOutstanding.replace(/[^0-9.-]/g, ''))}</td>
        </tr>
      </tfoot>
    `;

    detailTable.innerHTML = detailHTML;
    container.appendChild(detailTable);

    return container;
  }

  // Expose to global scope
  window.exportUnpaidInvoicesReport = exportUnpaidInvoicesReport;

  // Auto-bind to export button if present
  document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('unpaidInvoicesExport');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportUnpaidInvoicesReport);
    }
  });

  console.log('client_report_export: ready');
})();
