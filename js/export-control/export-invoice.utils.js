(function () {
    window.ExportInvoice = window.ExportInvoice || {};

    window.ExportInvoice.getVisibleElById = function (id) {
        const els = document.querySelectorAll('#' + id);
        for (let i = 0; i < els.length; i++) {
            const el = els[i];
            if ((el.offsetParent !== null) || (el.getClientRects && el.getClientRects().length > 0)) {
                return el;
            }
        }
        return document.getElementById(id);
    };

    window.ExportInvoice.waitForImages = function (root, timeout = 3000) {
        return new Promise((resolve) => {
            const imgs = Array.from(root.querySelectorAll('img'));
            if (!imgs.length) return resolve();
            let loaded = 0;
            const done = () => { loaded++; if (loaded >= imgs.length) resolve(); };
            imgs.forEach(img => {
                if (img.complete) return done();
                img.addEventListener('load', done);
                img.addEventListener('error', done);
            });
            setTimeout(resolve, timeout);
        });
    };

    window.ExportInvoice.computeContentHeight = function (rootEl) {
        try {
            const rect = rootEl.getBoundingClientRect();
            const top = rect.top;
            let bottom = rect.bottom;
            const selectors = ['#export-header', '#export-invoice-details', '#itemsTable', '.totals', '#export-balance-due', '#export-remaining-balance', '.notes', '.bank-details'];
            selectors.forEach(sel => {
                const node = rootEl.querySelector(sel);
                if (node) {
                    const r = node.getBoundingClientRect();
                    if (r.height > 0) bottom = Math.max(bottom, r.bottom);
                }
            });
            const contentHeight = Math.max(0, bottom - top);
            return Math.ceil(contentHeight);
        } catch (e) {
            return rootEl.scrollHeight || 0;
        }
    };

    window.ExportInvoice.temporarilyUnclipAncestors = function (rootEl) {
        const changed = [];
        let cur = rootEl;
        while (cur && cur !== document.documentElement) {
            const prev = { overflow: cur.style.overflow, maxHeight: cur.style.maxHeight, height: cur.style.height };
            cur.style.overflow = 'visible';
            cur.style.maxHeight = 'none';
            cur.style.height = 'auto';
            changed.push({ cur, prev });
            cur = cur.parentElement;
        }
        const html = document.documentElement;
        const body = document.body;
        const prevHtml = { overflow: html.style.overflow, height: html.style.height };
        const prevBody = { overflow: body.style.overflow, height: body.style.height };
        html.style.overflow = 'visible'; html.style.height = 'auto';
        body.style.overflow = 'visible'; body.style.height = 'auto';
        return () => {
            changed.forEach(c => {
                try {
                    c.cur.style.overflow = c.prev.overflow || '';
                    c.cur.style.maxHeight = c.prev.maxHeight || '';
                    c.cur.style.height = c.prev.height || '';
                } catch (e) {}
            });
            html.style.overflow = prevHtml.overflow || '';
            html.style.height = prevHtml.height || '';
            body.style.overflow = prevBody.overflow || '';
            body.style.height = prevBody.height || '';
        };
    };
})();
