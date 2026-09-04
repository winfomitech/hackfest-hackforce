import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getFilterOptions from '@salesforce/apex/GuestSentimentDashboardController.getFilterOptions';
import getDashboardData from '@salesforce/apex/GuestSentimentDashboardController.getDashboardData';

const DEPT_COLORS = {
    Electrical: '#F5A623',
    Plumbing: '#4A90D9',
    Housekeeping: '#2FB27C',
    General: '#9B7FE0'
};
const SEVERITY_COLORS = { High: '#E5484D', Medium: '#F5A623', Low: '#2FB27C' };
const SENTIMENT_COLORS = { Positive: '#2FB27C', Neutral: '#8792A2', Negative: '#E5484D' };

const DATE_PRESETS = [
    { label: 'All time', value: 'All' },
    { label: 'Today', value: 'Today' },
    { label: 'Yesterday', value: 'Yesterday' },
    { label: 'Last 7 days', value: 'Last7' },
    { label: 'Last 30 days', value: 'Last30' },
    { label: 'This month', value: 'ThisMonth' },
    { label: 'Custom range', value: 'Custom' }
];

const STATUS_OPTIONS = [
    { label: 'All statuses', value: 'All' },
    { label: 'Open', value: 'Open' },
    { label: 'Resolved', value: 'Resolved' }
];

export default class GuestSentimentDashboard extends LightningElement {
    @api title = 'Guest Sentiment Radar — Operations';

    filterOptions = { floors: [], departments: [], severities: [], sentiments: [] };
    data = null;
    isLoading = true;
    hasError = false;
    lastUpdated = null;

    selectedFloors = [];
    selectedDepartments = [];
    selectedSeverities = [];
    selectedSentiments = [];
    status = 'All';
    escalatedOnly = false;
    datePreset = 'All';
    customFrom = null;
    customTo = null;

    datePresetOptions = DATE_PRESETS;
    statusOptions = STATUS_OPTIONS;

    connectedCallback() {
        this.loadFilterOptions();
        this.loadData();
    }

    async loadFilterOptions() {
        try {
            const opts = await getFilterOptions();
            this.filterOptions = {
                floors: (opts.floors || []).slice().sort(),
                departments: opts.departments || [],
                severities: opts.severities || [],
                sentiments: opts.sentiments || []
            };
        } catch (e) {
            this.notifyError('Could not load filter options', e);
        }
    }

    errorMessage = '';

    async loadData() {
        this.isLoading = true;
        this.hasError = false;
        this.errorMessage = '';
        const { fromISO, toISO } = this.resolveDateBounds();
        try {
            const result = await getDashboardData({
                floors: this.selectedFloors,
                departments: this.selectedDepartments,
                severities: this.selectedSeverities,
                sentiments: this.selectedSentiments,
                status: this.status === 'All' ? null : this.status,
                escalatedOnly: this.escalatedOnly,
                dateFrom: fromISO,
                dateTo: toISO
            });
            this.data = result;
            this.lastUpdated = new Date();
        } catch (e) {
            this.hasError = true;
            this.errorMessage = (e && e.body && e.body.message) ? e.body.message : (e && e.message) || 'Unknown error';
            this.notifyError('Could not load dashboard data', e);
        } finally {
            this.isLoading = false;
        }
    }

    resolveDateBounds() {
        if (this.datePreset === 'All') return { fromISO: null, toISO: null };
        if (this.datePreset === 'Custom') {
            return {
                fromISO: this.customFrom ? new Date(this.customFrom + 'T00:00:00').toISOString() : null,
                toISO: this.customTo ? new Date(this.customTo + 'T23:59:59').toISOString() : null
            };
        }
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let from;
        let to = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
        switch (this.datePreset) {
            case 'Today':
                from = startOfToday;
                break;
            case 'Yesterday':
                from = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
                to = new Date(startOfToday.getTime() - 1);
                break;
            case 'Last7':
                from = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
                break;
            case 'Last30':
                from = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);
                break;
            case 'ThisMonth':
                from = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            default:
                from = null;
        }
        return { fromISO: from ? from.toISOString() : null, toISO: to ? to.toISOString() : null };
    }

    notifyError(title, e) {
        const message = (e && e.body && e.body.message) ? e.body.message : (e && e.message) || 'Unknown error';
        this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'error' }));
    }

    togglePill(list, value) {
        return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    }

    handleFloorToggle(event) {
        this.selectedFloors = this.togglePill(this.selectedFloors, event.currentTarget.dataset.value);
        this.loadData();
    }
    handleDepartmentToggle(event) {
        this.selectedDepartments = this.togglePill(this.selectedDepartments, event.currentTarget.dataset.value);
        this.loadData();
    }
    handleSeverityToggle(event) {
        this.selectedSeverities = this.togglePill(this.selectedSeverities, event.currentTarget.dataset.value);
        this.loadData();
    }
    handleSentimentToggle(event) {
        this.selectedSentiments = this.togglePill(this.selectedSentiments, event.currentTarget.dataset.value);
        this.loadData();
    }
    handleStatusToggle(event) {
        this.status = event.currentTarget.dataset.value;
        this.loadData();
    }
    handleEscalatedToggle(event) {
        this.escalatedOnly = event.target.checked;
        this.loadData();
    }
    handleDatePresetChange(event) {
        this.datePreset = event.detail.value;
        if (this.datePreset !== 'Custom') this.loadData();
    }
    handleCustomFromChange(event) {
        this.customFrom = event.detail.value;
        if (this.customFrom && this.customTo) this.loadData();
    }
    handleCustomToChange(event) {
        this.customTo = event.detail.value;
        if (this.customFrom && this.customTo) this.loadData();
    }
    handleClearFilters() {
        this.selectedFloors = [];
        this.selectedDepartments = [];
        this.selectedSeverities = [];
        this.selectedSentiments = [];
        this.status = 'All';
        this.escalatedOnly = false;
        this.datePreset = 'All';
        this.customFrom = null;
        this.customTo = null;
        this.loadData();
    }
    handleRefresh() {
        this.loadData();
    }

    get showCustomDateRange() {
        return this.datePreset === 'Custom';
    }

    get lastUpdatedLabel() {
        return this.lastUpdated ? this.lastUpdated.toLocaleTimeString() : '';
    }

    get hasActiveFilters() {
        return (
            this.selectedFloors.length > 0 ||
            this.selectedDepartments.length > 0 ||
            this.selectedSeverities.length > 0 ||
            this.selectedSentiments.length > 0 ||
            this.status !== 'All' ||
            this.escalatedOnly ||
            this.datePreset !== 'All'
        );
    }

    get floorPills() {
        return this.filterOptions.floors.map((f) => ({
            value: f,
            label: 'Floor ' + f,
            cssClass: this.pillClass(this.selectedFloors.includes(f))
        }));
    }
    get departmentPills() {
        return this.filterOptions.departments.map((d) => ({
            value: d,
            label: d,
            cssClass: this.pillClass(this.selectedDepartments.includes(d))
        }));
    }
    get severityPills() {
        return this.filterOptions.severities.map((s) => ({
            value: s,
            label: s,
            cssClass: this.pillClass(this.selectedSeverities.includes(s))
        }));
    }
    get sentimentPills() {
        return this.filterOptions.sentiments.map((s) => ({
            value: s,
            label: s,
            cssClass: this.pillClass(this.selectedSentiments.includes(s))
        }));
    }
    get statusPills() {
        return this.statusOptions.map((o) => ({
            value: o.value,
            label: o.label,
            cssClass: this.pillClass(this.status === o.value)
        }));
    }
    pillClass(selected) {
        return 'pill' + (selected ? ' pill-selected' : '');
    }

    get kpis() {
        if (!this.data) return [];
        const defs = [
            { key: 'total', label: 'Total Cases', value: this.data.totalCases, accent: 'accent-indigo' },
            { key: 'open', label: 'Open', value: this.data.openCases, accent: 'accent-amber' },
            { key: 'resolved', label: 'Resolved', value: this.data.resolvedCases, accent: 'accent-green' },
            { key: 'escalated', label: 'Escalated', value: this.data.escalatedCases, accent: 'accent-red' },
            { key: 'avgRes', label: 'Avg Resolution (min)', value: this.data.avgResolutionMinutes, accent: 'accent-teal' },
            { key: 'avgEta', label: 'Avg ETA Promised (min)', value: this.data.avgEtaMinutes, accent: 'accent-indigo' }
        ];
        return defs.map((d) => ({ ...d, tileClass: 'gsr-kpi-tile ' + d.accent }));
    }

    get hasCases() {
        return this.data && this.data.totalCases > 0;
    }

    get departmentBars() {
        if (!this.data) return [];
        const max = Math.max(1, ...this.data.byCategory.map((c) => c.count));
        return this.data.byCategory.map((c) => {
            const pct = Math.max(4, Math.round((c.count / max) * 100));
            const color = DEPT_COLORS[c.label] || '#4A90D9';
            return { label: c.label, count: c.count, pct, fillStyle: 'background:' + color + ';width:' + pct + '%' };
        });
    }

    get resourceRows() {
        if (!this.data) return [];
        const max = Math.max(1, ...this.data.resourceLoad.map((r) => r.openCount));
        return this.data.resourceLoad.map((r) => {
            const pct = Math.max(4, Math.round((r.openCount / max) * 100));
            const color = DEPT_COLORS[r.department] || '#4A90D9';
            return {
                key: r.name,
                name: r.name,
                department: r.department,
                floor: r.floor,
                openCount: r.openCount,
                fillStyle: 'background:' + color + ';width:' + pct + '%',
                statusLabel: r.onDuty && r.available ? 'On duty' : (!r.available ? 'Unavailable' : 'Off shift'),
                statusDotClass: 'status-dot ' + (r.onDuty && r.available ? 'dot-green' : (!r.available ? 'dot-red' : 'dot-gray'))
            };
        });
    }

    get severityLegend() {
        return this.donutLegend(this.data ? this.data.bySeverity : [], SEVERITY_COLORS);
    }
    get severityDonutStyle() {
        return this.donutStyle(this.data ? this.data.bySeverity : [], SEVERITY_COLORS);
    }
    get sentimentLegend() {
        return this.donutLegend(this.data ? this.data.bySentiment : [], SENTIMENT_COLORS);
    }
    get sentimentDonutStyle() {
        return this.donutStyle(this.data ? this.data.bySentiment : [], SENTIMENT_COLORS);
    }

    donutLegend(items, colorMap) {
        const total = items.reduce((sum, i) => sum + i.count, 0);
        return items.map((i) => ({
            key: i.label,
            label: i.label,
            count: i.count,
            pct: total > 0 ? Math.round((i.count / total) * 100) : 0,
            swatchStyle: 'background:' + (colorMap[i.label] || '#8792A2')
        }));
    }

    donutStyle(items, colorMap) {
        const total = items.reduce((sum, i) => sum + i.count, 0);
        if (total === 0) return 'background: conic-gradient(#E4E7EC 0deg 360deg)';
        let cursor = 0;
        const segments = items.map((i) => {
            const start = cursor;
            const sweep = (i.count / total) * 360;
            cursor += sweep;
            return (colorMap[i.label] || '#8792A2') + ' ' + start + 'deg ' + cursor + 'deg';
        });
        return 'background: conic-gradient(' + segments.join(', ') + ')';
    }

    get trendBars() {
        if (!this.data || !this.data.trend.length) return [];
        const max = Math.max(1, ...this.data.trend.map((t) => t.count));
        return this.data.trend.map((t) => {
            const heightPct = Math.max(6, Math.round((t.count / max) * 100));
            return { key: t.label, label: this.shortDate(t.label), count: t.count, barStyle: 'height:' + heightPct + '%' };
        });
    }

    shortDate(isoDay) {
        const d = new Date(isoDay + 'T00:00:00');
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    caseColumns = [
        { label: 'Case #', fieldName: 'caseNumber', type: 'text' },
        { label: 'Room', fieldName: 'room', type: 'text' },
        { label: 'Floor', fieldName: 'floor', type: 'number' },
        { label: 'Category', fieldName: 'category', type: 'text' },
        { label: 'Severity', fieldName: 'severity', type: 'text' },
        { label: 'Sentiment', fieldName: 'sentiment', type: 'text' },
        { label: 'Status', fieldName: 'statusLabel', type: 'text' },
        { label: 'Escalated', fieldName: 'escalatedLabel', type: 'text' },
        { label: 'Assigned', fieldName: 'assignedResource', type: 'text' },
        { label: 'Floor Manager', fieldName: 'floorManager', type: 'text' },
        { label: 'Created', fieldName: 'createdDate', type: 'date', typeAttributes: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } },
        { label: 'ETA', fieldName: 'estimatedAttendTime', type: 'date', typeAttributes: { hour: '2-digit', minute: '2-digit' } },
        { label: 'Resolved', fieldName: 'closedDate', type: 'date', typeAttributes: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } }
    ];

    get caseRows() {
        if (!this.data) return [];
        return this.data.cases.map((c) => ({
            ...c,
            statusLabel: c.isClosed ? 'Resolved' : 'Open',
            escalatedLabel: c.escalated ? 'Yes' : 'No'
        }));
    }
}
