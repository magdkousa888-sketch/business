document.addEventListener('DOMContentLoaded', function () {
    const toolbarTop = document.querySelector('#sideToolbar .toolbar-top');
    if (!toolbarTop) return;

    const btn = document.createElement('button');
    btn.id = 'exportInvoiceBtn';
    btn.className = 'toolbar-btn';
    btn.title = 'Export to PDF';
    btn.setAttribute('aria-label', 'Export to PDF');
    btn.innerHTML = `<i class="bi bi-file-earmark-pdf" aria-hidden="true"></i>`;

    const separator = toolbarTop.querySelector('.toolbar-separator');
    if (separator && separator.parentNode) separator.parentNode.insertBefore(btn, separator);
    else toolbarTop.appendChild(btn);
});
