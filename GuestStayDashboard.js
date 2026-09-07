import { LightningElement, api, wire, track } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getGuestStayData from '@salesforce/apex/GuestStayDashboardController.getGuestStayData';

const AMENITY_ICONS = {
    'Ocean View': '🌊',
    'King Bed': '🛏️',
    'Balcony': '🌅',
    'Mini Bar': '🍷',
    'Garden View': '🌿',
    'Queen Bed': '🛏️',
    'City View': '🏙️',
    'Jacuzzi': '🛁',
    'Pool Access': '🏊',
    'Gym Access': '💪'
};

export default class GuestStayDashboard extends LightningElement {
    @api roomNumber;

    @track dashboardData;
    @track activeTab = 'stay';
    @track showWifi = false;
    @track timerDays = '00';
    @track timerHours = '00';
    @track timerMinutes = '00';
    @track timerSeconds = '00';
    @track stayProgressPercent = 0;

    isLoading = true;
    hasError = false;
    _timerInterval;

    // ─── URL PARAMETER EXTRACTION ───

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            const urlRoom = currentPageReference.state?.room || 
                            new URLSearchParams(window.location.search).get('room');
            console.log('urlRoom: '+ urlRoom);
            if (!this.roomNumber && urlRoom) {
                this.roomNumber = urlRoom;
            } else if (!this.roomNumber && !urlRoom) {
                this.isLoading = false;
                this.hasError = true;
            }
            console.log('this.roomNumber: '+this.roomNumber);
        }
    }

    disconnectedCallback() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
        }
    }

    // ─── DATA ───

    @wire(getGuestStayData, { roomNumber: '$roomNumber' })
    wiredData({ error, data }) {
        console.log('this.roomNumber: '+this.roomNumber);
        
            console.log('Guest Stay Data Error: '+ error);
        
        console.log('Guest Stay Data: '+ JSON.stringify(data));
        if (!this.roomNumber) return;
        if (data) {
            this.dashboardData = data;
            this.isLoading = false;
            this.hasError = false;
            this._startTimer();
        } else if (error) {
            console.log('Guest Stay Data Error: '+ error);
            this.isLoading = false;
            this.hasError = true;
            console.error('GuestStayDashboard error:', error);
        }
    }

    // ─── TIMER ───

    _startTimer() {
        this._updateTimer();
        this._timerInterval = setInterval(() => {
            this._updateTimer();
        }, 1000);
    }

    _updateTimer() {
        if (!this.dashboardData?.currentStay?.Check_Out_Date__c) return;

        const checkOut = new Date(this.dashboardData.currentStay.Check_Out_Date__c);
        const now = new Date();
        let diff = checkOut.getTime() - now.getTime();

        if (diff <= 0) {
            this.timerDays = '00';
            this.timerHours = '00';
            this.timerMinutes = '00';
            this.timerSeconds = '00';
            clearInterval(this._timerInterval);
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        diff -= days * (1000 * 60 * 60 * 24);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        diff -= hours * (1000 * 60 * 60);
        const minutes = Math.floor(diff / (1000 * 60));
        diff -= minutes * (1000 * 60);
        const seconds = Math.floor(diff / 1000);

        this.timerDays = String(days).padStart(2, '0');
        this.timerHours = String(hours).padStart(2, '0');
        this.timerMinutes = String(minutes).padStart(2, '0');
        this.timerSeconds = String(seconds).padStart(2, '0');

        // Update progress
        const checkIn = new Date(this.dashboardData.currentStay.Check_In_Date__c);
        const total = checkOut.getTime() - checkIn.getTime();
        const elapsed = now.getTime() - checkIn.getTime();
        this.stayProgressPercent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    }

    // ─── COMPUTED: State ───

    get hasData() {
        return !this.isLoading && !this.hasError && this.dashboardData;
    }

    // ─── COMPUTED: Guest ───

    get guestName() {
        return this.dashboardData?.guest?.Name || '';
    }

    get guestInitials() {
        const name = this.guestName;
        if (!name) return '';
        return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
    }

    get loyaltyTier() {
        return this.dashboardData?.guest?.Loyalty_Tier__c || 'Member';
    }

    get loyaltyBadgeClass() {
        const tier = (this.loyaltyTier || '').toLowerCase();
        return `loyalty-badge loyalty-${tier}`;
    }

    get memberSince() {
        return this.dashboardData?.guest?.Member_Since__c || '';
    }

    get totalStays() {
        return this.dashboardData?.totalStays || 0;
    }

    // ─── COMPUTED: Room ───

    get floorNumber() {
        return this.dashboardData?.room?.Floor__c || '';
    }

    get roomType() {
        return this.dashboardData?.room?.Room_Type__c || 'Standard Room';
    }

    // ─── COMPUTED: Current Stay ───

    get rateDisplay() {
        const rate = this.dashboardData?.currentStay?.Rate_Per_Night__c;
        return rate ? `$${rate}` : '';
    }

    get stayNights() {
        const stay = this.dashboardData?.currentStay;
        if (!stay?.Check_In_Date__c || !stay?.Check_Out_Date__c) return 0;
        const ms = new Date(stay.Check_Out_Date__c) - new Date(stay.Check_In_Date__c);
        return Math.round(ms / (1000 * 60 * 60 * 24));
    }

    get totalCost() {
        const rate = this.dashboardData?.currentStay?.Rate_Per_Night__c || 0;
        return `$${rate * this.stayNights}`;
    }

    get checkinDateFormatted() {
        return this._formatDate(this.dashboardData?.currentStay?.Check_In_Date__c);
    }

    get checkoutDateFormatted() {
        return this._formatDate(this.dashboardData?.currentStay?.Check_Out_Date__c);
    }

    get progressStyle() {
        return `width: ${this.stayProgressPercent}%`;
    }

    // ─── COMPUTED: Amenities ───

    get hasAmenities() {
        return this.dashboardData?.room?.Amenities__c?.length > 0;
    }

    get amenitiesList() {
        const raw = this.dashboardData?.room?.Amenities__c || '';
        if (!raw) return [];
        return raw.split(',').map((a, i) => {
            const label = a.trim();
            return {
                key: `amenity-${i}`,
                label: label,
                icon: AMENITY_ICONS[label] || '✨'
            };
        });
    }

    // ─── COMPUTED: Wi-Fi ───

    get hasWifiCode() {
        return !!this.dashboardData?.room?.Wi_Fi_Code__c;
    }

    get wifiDisplay() {
        if (this.showWifi) {
            return this.dashboardData?.room?.Wi_Fi_Code__c || '';
        }
        return '••••••••••••';
    }

    get wifiButtonLabel() {
        return this.showWifi ? 'Hide' : 'Show';
    }

    // ─── COMPUTED: Special Requests ───

    get hasSpecialRequests() {
        return this.dashboardData?.currentStay?.Special_Requests__c?.length > 0;
    }

    get specialRequestsList() {
        const raw = this.dashboardData?.currentStay?.Special_Requests__c || '';
        if (!raw) return [];
        return raw.split(',').map((r, i) => ({
            key: `req-${i}`,
            value: r.trim()
        }));
    }

    // ─── COMPUTED: Past Stays ───

    get pastStays() {
        return this.dashboardData?.pastStays || [];
    }

    get pastStayCount() {
        return this.pastStays.length;
    }

    get hasPastStays() {
        return this.pastStayCount > 0;
    }

    get noPastStays() {
        return this.pastStayCount === 0;
    }

    // ─── COMPUTED: Services ───

    get serviceItems() {
        return this.dashboardData?.serviceItems || [];
    }

    // ─── COMPUTED: Tabs ───

    get isStayTab() { return this.activeTab === 'stay'; }
    get isHistoryTab() { return this.activeTab === 'history'; }
    get isServicesTab() { return this.activeTab === 'services'; }

    get stayTabClass() {
        return `tab-btn ${this.activeTab === 'stay' ? 'tab-active' : ''}`;
    }
    get historyTabClass() {
        return `tab-btn ${this.activeTab === 'history' ? 'tab-active' : ''}`;
    }
    get servicesTabClass() {
        return `tab-btn ${this.activeTab === 'services' ? 'tab-active' : ''}`;
    }

    // ─── HANDLERS ───

    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    toggleWifi() {
        this.showWifi = !this.showWifi;
    }

    handleServiceClick(event) {
        const service = event.currentTarget.dataset.service;

        this.dispatchEvent(new CustomEvent('serviceselected', {
            detail: {
                service: service,
                roomNumber: this.roomNumber,
                guestName: this.guestName
            },
            bubbles: true,
            composed: true
        }));

        if (service === 'Report Issue') {
            try {
                if (window.embeddedservice_bootstrap?.utilAPI) {
                    window.embeddedservice_bootstrap.utilAPI.launchChat();
                }
            } catch (e) {
                console.log('Embedded messaging not available, dispatching event only.');
            }
        }
    }

    // ─── HELPERS ───

    _formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        return d.toLocaleDateString('en-US', options);
    }
}
