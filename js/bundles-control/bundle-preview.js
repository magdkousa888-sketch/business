// bundle-preview.js — Preview bundle items on hover
(function(){
  'use strict';

  function generateBundlePreview() {
    const textBefore = document.getElementById('bundleTextBefore')?.value.trim() || '';
    const defendant = document.getElementById('bundleDefendant')?.value.trim() || '';
    const textAfter = document.getElementById('bundleTextAfter')?.value.trim() || '';
    
    const tbody = document.getElementById('bundleItemsBody');
    if (!tbody) return 'No items';

    const items = Array.from(tbody.querySelectorAll('tr'))
      .map(tr => tr.querySelector('.bundle-item-name')?.value.trim())
      .filter(name => name);

    if (items.length === 0) return 'No items in bundle';

    return items.map(item => {
      const parts = [];
      if (textBefore) parts.push(textBefore);
      if (defendant) parts.push(defendant);
      if (textAfter) parts.push(textAfter);
      let addBrackets = document.getElementById('addBrackets')?.checked;
        if (addBrackets){
      parts.push(`(${item})`);
        } else {
      parts.push(item);
        }
      return parts.join(' ');
    }).join('\n');
  }

  function initBundlePreview() {
    const infoIcon = document.getElementById('bundleInfoIcon');
    if (!infoIcon) {
      console.warn('bundle-preview: info icon not found');
      return;
    }

    let tooltip = null;

    infoIcon.style.cursor = 'pointer';
    infoIcon.style.marginLeft = '8px';
    infoIcon.style.color = 'var(--primary-blue, #3b82f6)';

    infoIcon.addEventListener('mouseenter', (e) => {
      const preview = generateBundlePreview();
      
      tooltip = document.createElement('div');
      tooltip.className = 'bundle-preview-tooltip';
      tooltip.style.cssText = `
        position: fixed;
        background: #1f2937;
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.6;
        max-width: 500px;
        white-space: pre-wrap;
        z-index: 100000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        pointer-events: none;
      `;
      tooltip.textContent = preview;

      document.body.appendChild(tooltip);

      const iconRect = infoIcon.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let left = iconRect.right + 10;
      let top = iconRect.top;

      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = iconRect.left - tooltipRect.width - 10;
      }

      if (top + tooltipRect.height > window.innerHeight - 10) {
        top = window.innerHeight - tooltipRect.height - 10;
      }

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    });

    infoIcon.addEventListener('mouseleave', () => {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    });
  }

  window.initBundlePreview = initBundlePreview;

})();
