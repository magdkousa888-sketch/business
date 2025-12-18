(function () {
    window.ExportInvoice = window.ExportInvoice || {};

    const MAX_CANVAS_DIM = 32767;

    window.ExportInvoice.buildOptionsForElement = function (el, forcedHeightPx, pageWidthPx, pageHeightPx, pageData) {
        try {
            const rect = el.getBoundingClientRect();
            const elWidth = Math.ceil(el.scrollWidth || rect.width || el.offsetWidth || 800);
            const elHeight = Math.ceil((forcedHeightPx && Number.isFinite(forcedHeightPx)) ? forcedHeightPx : (el.scrollHeight || rect.height || el.offsetHeight || 1100));
            const buffer = 80;
            const width = Math.min(elWidth + buffer, pageWidthPx || elWidth + buffer);
            const height = elHeight + buffer;
            const desiredScale = 3;
            const maxScaleForWidth = Math.floor(MAX_CANVAS_DIM / (width || 1));
            const maxScaleForHeight = Math.floor(MAX_CANVAS_DIM / (height || 1));
            const maxScale = Math.max(1, Math.min(desiredScale, maxScaleForWidth || desiredScale, maxScaleForHeight || desiredScale));
            if (maxScale < desiredScale) console.warn('html2canvas scale capped to avoid large canvas', {desiredScale, cappedScale: maxScale, width, height});
            const scale = Math.max(1, maxScale);
            const invNum = (pageData && pageData.invoiceNumber) ? String(pageData.invoiceNumber).trim() : '';
            const safeName = (invNum ? invNum.replace(/[^a-zA-Z0-9_.-]/g, '_') : 'invoice') + '.pdf';
            return {
                margin: 0.4,
                filename: safeName,
                pagebreak: { mode: ['css', 'legacy'] },
                html2canvas: {
                    scale: scale,
                    useCORS: true,
                    logging: true,
                    scrollY: 0,
                    width: width,
                    height: height,
                    windowWidth: Math.max(pageWidthPx || width, document.documentElement.clientWidth || width),
                    windowHeight: Math.max(height, document.documentElement.clientHeight || height)
                },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
        } catch (e) {
            console.warn('Could not build dynamic html2pdf options, falling back to defaults', e);
            const invNum2 = (pageData && pageData.invoiceNumber) ? String(pageData.invoiceNumber).trim() : '';
            const safeName2 = (invNum2 ? invNum2.replace(/[^a-zA-Z0-9_.-]/g, '_') : 'invoice') + '.pdf';
            return {
                margin: 0.4,
                filename: safeName2,
                html2canvas: { scale: 2, useCORS: true, logging: true, scrollY: 0 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
        }
    };

    window.ExportInvoice.exportInChunks = async function (rootEl, scale, pageWidthPx, pageHeightPx, pageData) {
        if (typeof jsPDF === 'undefined') { console.error('jsPDF not loaded; cannot export in chunks'); return Promise.reject('jsPDF not available'); }
        const doc = new jsPDF('p', 'pt', 'letter');
        const pageWidthPt = doc.internal.pageSize.getWidth();
        const pageHeightPt = doc.internal.pageSize.getHeight();
        const pxToPt = 72 / 96;
        const pageWidthPxComputed = Math.floor(pageWidthPt / pxToPt);
        const pageHeightPxComputed = Math.floor(pageHeightPt / pxToPt);
        const elRect = rootEl.getBoundingClientRect();
        const elWidth = Math.ceil(rootEl.scrollWidth || elRect.width || rootEl.offsetWidth || 800);
        const elHeight = Math.ceil(rootEl.scrollHeight || elRect.height || rootEl.offsetHeight || 1100);
        let renderScale = scale || 1;
        if (elWidth * renderScale > MAX_CANVAS_DIM) { renderScale = Math.max(1, Math.floor(MAX_CANVAS_DIM / elWidth)); console.warn('Chunk export: scale reduced to fit width', renderScale); }
        const chunkHeightPx = pageHeightPxComputed;
        const numChunks = Math.ceil(elHeight / chunkHeightPx);
        for (let i = 0; i < numChunks; i++) {
            const offsetY = i * chunkHeightPx;
            const clone = rootEl.cloneNode(true);
            const clipWrapper = document.createElement('div');
            clipWrapper.style.position = 'fixed';
            clipWrapper.style.left = '0';
            clipWrapper.style.top = '0';
            clipWrapper.style.zIndex = '999999';
            clipWrapper.style.overflow = 'hidden';
            clipWrapper.style.width = (pageWidthPx || pageWidthPxComputed) + 'px';
            clipWrapper.style.height = chunkHeightPx + 'px';
            clipWrapper.style.display = 'flex';
            clipWrapper.style.justifyContent = 'center';
            clipWrapper.style.pointerEvents = 'none';
            clone.style.transform = `translateY(-${offsetY}px)`;
            const horizontalOffset = Math.max(0, Math.round(((pageWidthPx || pageWidthPxComputed) - elWidth) / 2));
            clone.style.marginLeft = horizontalOffset + 'px';
            clone.style.transformOrigin = 'top left';
            clipWrapper.appendChild(clone);
            document.body.appendChild(clipWrapper);
            try {
                const canvas = await html2canvas(clipWrapper, { scale: renderScale, useCORS: true, logging: true, width: (pageWidthPx || pageWidthPxComputed), height: chunkHeightPx, windowWidth: Math.max(pageWidthPx || pageWidthPxComputed, window.innerWidth), windowHeight: Math.min(chunkHeightPx, window.innerHeight * 2) });
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                doc.addImage(imgData, 'JPEG', 0, 0, pageWidthPt, pageHeightPt);
                if (i < numChunks - 1) doc.addPage();
            } catch (err) {
                try { document.body.removeChild(clipWrapper); } catch (e) {}
                throw err;
            }
            try { document.body.removeChild(clipWrapper); } catch (e) {}
        }
        const invNum = (pageData && pageData.invoiceNumber) ? String(pageData.invoiceNumber).trim() : '';
        const filename = (invNum ? invNum.replace(/[^a-zA-Z0-9_.-]/g, '_') : 'invoice') + '.pdf';
        doc.save(filename);
        return Promise.resolve();
    };

    // Main exporter: accepts the collected page data and performs export
    window.ExportInvoice.exportFromData = async function (pageData) {
        // create temp container and render
        let tempContainer = document.createElement('div');
        tempContainer.classList.add('export-temp-container');
        tempContainer.innerHTML = window.ExportInvoice.template;
        document.body.appendChild(tempContainer);

        // compute page sizes
        const PX_PER_INCH = 96;
        const DEFAULT_PAGE_WIDTH_IN = 8.5; const DEFAULT_PAGE_HEIGHT_IN = 11;
        let pageWidthPx = Math.floor(DEFAULT_PAGE_WIDTH_IN * PX_PER_INCH);
        let pageHeightPx = Math.floor(DEFAULT_PAGE_HEIGHT_IN * PX_PER_INCH);
        if (typeof jsPDF !== 'undefined') {
            try { const tmpDoc = new jsPDF('p', 'pt', 'letter'); const pageWidthPt = tmpDoc.internal.pageSize.getWidth(); pageWidthPx = Math.floor(pageWidthPt * (PX_PER_INCH / 72)); const pageHeightPt = tmpDoc.internal.pageSize.getHeight(); pageHeightPx = Math.floor(pageHeightPt * (PX_PER_INCH / 72)); } catch (e) {}
        }

        // center wrapper
        try {
            const centerWrapper = document.createElement('div');
            centerWrapper.className = 'export-center-wrapper';
            centerWrapper.style.width = pageWidthPx + 'px';
            centerWrapper.style.display = 'flex';
            centerWrapper.style.justifyContent = 'center';
            centerWrapper.style.pointerEvents = 'none';
            const inner = tempContainer.querySelector('#export-invoice-wrapper') || tempContainer.querySelector('#export-invoice') || tempContainer.firstElementChild;
            if (inner && inner.parentNode === tempContainer) { tempContainer.replaceChild(centerWrapper, inner); centerWrapper.appendChild(inner); }
            else if (inner) { centerWrapper.appendChild(inner); tempContainer.appendChild(centerWrapper); }
            else tempContainer.appendChild(centerWrapper);
        } catch (e) { console.warn('Failed to create centering wrapper', e); }

        try { tempContainer.style.position = 'fixed'; tempContainer.style.left = '0'; tempContainer.style.top = '0'; tempContainer.style.zIndex = '99999'; tempContainer.style.background = '#fff'; tempContainer.style.overflow = 'visible'; tempContainer.style.pointerEvents = 'none'; } catch (e) {}

        const wrapper = tempContainer.querySelector('#export-invoice-wrapper') || tempContainer.querySelector('#export-invoice') || tempContainer.firstElementChild;
        if (wrapper) { window.ExportInvoice.populateExportWrapper(wrapper, pageData); try { wrapper.removeAttribute('hidden'); } catch (e) {} }
        let element = wrapper || tempContainer.firstElementChild;
        if (!element) { try { if (tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer); } catch (e) {} console.error('No export element found to render'); return; }

        // ensure no clipping
        const restoreAncestors = window.ExportInvoice.temporarilyUnclipAncestors(element);
        try { tempContainer.style.width = pageWidthPx + 'px'; tempContainer.style.height = (element.scrollHeight || element.offsetHeight) + 'px'; } catch (e) {}
        const prevElStyles = { position: element.style.position, left: element.style.left, top: element.style.top, width: element.style.width };
        element.style.position = 'relative'; element.style.left = '0'; element.style.top = '0'; element.style.width = 'auto';

        // compact height for short invoices
        const rowCount = (element.querySelectorAll && element.querySelectorAll('#itemsTable tr').length) || 0;
        let forcedHeight = null;
        if (rowCount <= 5) { const contentHeightPx = window.ExportInvoice.computeContentHeight(element); forcedHeight = Math.max(contentHeightPx + 80, 400); if (forcedHeight > pageHeightPx) forcedHeight = pageHeightPx; try { if (forcedHeight) tempContainer.style.height = forcedHeight + 'px'; } catch (e) {} }

        const optionsForElement = window.ExportInvoice.buildOptionsForElement(element, forcedHeight, pageWidthPx, pageHeightPx, pageData);
        const canvasWidthPx = Math.ceil(element.scrollWidth || element.offsetWidth || 800);
        const canvasHeightPx = Math.ceil(element.scrollHeight || element.offsetHeight || 1100);
        const scaleToUse = (optionsForElement && optionsForElement.html2canvas && optionsForElement.html2canvas.scale) || 1;
        const willExceedMaxCanvas = (canvasWidthPx * scaleToUse > MAX_CANVAS_DIM) || ((forcedHeight || canvasHeightPx) * scaleToUse > MAX_CANVAS_DIM);

        const restoreTemp = () => { try { if (tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer); } catch (e) {} };

        const finalizeRestore = () => {
            try { restoreTemp(); } catch (e) {}
            try { if (restoreAncestors) restoreAncestors(); } catch (e) {}
            try { element.style.position = prevElStyles.position || ''; element.style.left = prevElStyles.left || ''; element.style.top = prevElStyles.top || ''; element.style.width = prevElStyles.width || ''; } catch (e) {}
        };

        if (willExceedMaxCanvas) {
            try { if (forcedHeight) tempContainer.style.height = forcedHeight + 'px'; } catch (e) {}
            window.ExportInvoice.exportInChunks(element, scaleToUse, pageWidthPx, pageHeightPx, pageData).then(() => { finalizeRestore(); console.log('Chunked export complete'); }).catch(err => { finalizeRestore(); console.error('Chunked export failed', err); });
        } else {
            try { if (forcedHeight) tempContainer.style.height = forcedHeight + 'px'; } catch (e) {}
            try { console.info('Starting PDF export as', optionsForElement.filename); } catch (e) {}
            html2pdf().set(optionsForElement).from(element).save().then(() => { finalizeRestore(); console.log('Export complete'); }).catch(err => { finalizeRestore(); console.error('Export failed:', err); });
        }
    };
})();
