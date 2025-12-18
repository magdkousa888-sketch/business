// Date Filter Presets - Auto date range selection
(function() {
    'use strict';

    function getDateRange(preset) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-11
        
        let startDate, endDate;
        
        switch(preset) {
            case 'current-month':
                // First day of current month to last day of current month
                startDate = new Date(year, month, 1);
                endDate = new Date(year, month + 1, 0); // Last day of current month
                break;
                
            case 'previous-month':
                // First day of previous month to last day of previous month
                startDate = new Date(year, month - 1, 1);
                endDate = new Date(year, month, 0); // Last day of previous month
                break;
                
            case 'this-quarter':
                // Quarters: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
                const currentQuarter = Math.floor(month / 3);
                const quarterStartMonth = currentQuarter * 3;
                startDate = new Date(year, quarterStartMonth, 1);
                endDate = new Date(year, quarterStartMonth + 3, 0); // Last day of quarter
                break;
                
            case 'this-year':
                // January 1st to December 31st of current year
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31);
                break;
                
            default:
                return { startDate: null, endDate: null };
        }
        
        return { startDate, endDate };
    }
    
    function formatDateForInput(date) {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    function applyDatePreset(preset) {
        const { startDate, endDate } = getDateRange(preset);
        
        const dateFromInput = document.getElementById('filterDateFrom');
        const dateToInput = document.getElementById('filterDateTo');
        
        if (dateFromInput) {
            dateFromInput.value = formatDateForInput(startDate);
        }
        
        if (dateToInput) {
            dateToInput.value = formatDateForInput(endDate);
        }
        
        console.log(`📅 Date preset applied: ${preset}`, {
            from: formatDateForInput(startDate),
            to: formatDateForInput(endDate)
        });
        
        // Automatically trigger filter application if the function exists
        if (typeof window.applyFilters === 'function') {
            window.applyFilters();
        }
    }
    
    function clearDatePreset() {
        const dateFromInput = document.getElementById('filterDateFrom');
        const dateToInput = document.getElementById('filterDateTo');
        const presetDropdown = document.getElementById('datePresetDropdown');
        
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        if (presetDropdown) presetDropdown.value = '';
        
        console.log('📅 Date preset cleared');
    }
    
    function initializeDatePresets() {
        const presetDropdown = document.getElementById('datePresetDropdown');
        
        if (!presetDropdown) {
            console.log('Date preset dropdown not found');
            return;
        }
        
        presetDropdown.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value) {
                applyDatePreset(value);
            } else {
                clearDatePreset();
            }
        });
        
        console.log('✅ Date presets initialized');
    }
    
    // Expose API
    window.dateFilterPresets = {
        getDateRange,
        formatDateForInput,
        applyDatePreset,
        clearDatePreset,
        initializeDatePresets
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDatePresets);
    } else {
        initializeDatePresets();
    }
    
})();
