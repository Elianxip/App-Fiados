// Data Structure in LocalStorage:
// clients: [ { id: string, name: string, phone: string, createdAt: number } ]
// transactions: [ { id: string, clientId: string, type: 'DEBT'|'PAYMENT', amount: number, desc: string, date: number } ]

const Icons = {
    cart: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`
};

class DataStore {
    static getClients() {
        return JSON.parse(localStorage.getItem('fiado_clients')) || [];
    }
    static saveClients(clients) {
        localStorage.setItem('fiado_clients', JSON.stringify(clients));
        if (window.FiadosCloud) window.FiadosCloud.syncAfterLocalSave();
    }
    static addClient(client) {
        const clients = this.getClients();
        clients.push(client);
        this.saveClients(clients);
    }

    static getTransactions() {
        return JSON.parse(localStorage.getItem('fiado_txs')) || [];
    }
    static saveTransactions(txs) {
        localStorage.setItem('fiado_txs', JSON.stringify(txs));
        if (window.FiadosCloud) window.FiadosCloud.syncAfterLocalSave();
    }
    static addTransaction(tx) {
        const txs = this.getTransactions();
        txs.push(tx);
        this.saveTransactions(txs);
    }

    static getClientTransactions(clientId) {
        return this.getTransactions()
            .filter(tx => tx.clientId === clientId)
            .sort((a,b) => b.date - a.date);
    }

    static getClientBalance(clientId) {
        const txs = this.getClientTransactions(clientId);
        return txs.reduce((acc, tx) => {
            if (tx.type === 'DEBT') return acc + tx.amount;
            if (tx.type === 'PAYMENT') return acc - tx.amount;
            return acc;
        }, 0);
    }

    static getTotalDebt() {
        const clients = this.getClients();
        return clients.reduce((acc, c) => acc + this.getClientBalance(c.id), 0);
    }
}

// UI Controller
const App = {
    currentView: 'dashboard',
    currentClientId: null,

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.render();
    },

    cacheDOM() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.views = document.querySelectorAll('.view');
        
        // Modals
        this.modalOverlay = document.getElementById('modal-overlay');
        this.modals = document.querySelectorAll('.modal');
        this.closeButtons = document.querySelectorAll('.btn-close-modal');
        
        // Forms
        this.formAddClient = document.getElementById('form-add-client');
        this.formAddDebt = document.getElementById('form-add-debt');
        this.formAddPayment = document.getElementById('form-add-payment');

        // Elements
        this.clientsList = document.getElementById('clients-list');
        this.recentTxList = document.getElementById('recent-transactions-list');
    },

    bindEvents() {
        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                if(view) this.navigate(view);
            });
        });

        document.getElementById('btn-back-clients').addEventListener('click', () => this.navigate('clients'));

        // Modal Triggers
        document.getElementById('btn-add-client').addEventListener('click', () => this.openModal('modal-add-client'));
        document.getElementById('btn-add-debt').addEventListener('click', () => this.openModal('modal-add-debt'));
        document.getElementById('btn-add-payment').addEventListener('click', () => this.openModal('modal-add-payment'));

        // Close Modals
        this.closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) this.closeModals();
        });

        // Form Submits
        this.formAddClient.addEventListener('submit', (e) => this.handleAddClient(e));
        this.formAddDebt.addEventListener('submit', (e) => this.handleAddDebt(e));
        this.formAddPayment.addEventListener('submit', (e) => this.handleAddPayment(e));
    },

    navigate(viewId, param = null) {
        this.currentView = viewId;
        
        // Update Nav
        this.navItems.forEach(item => {
            if(item.dataset.view) {
                item.classList.toggle('active', item.dataset.view === viewId);
            }
        });

        // Update Views
        this.views.forEach(view => {
            view.classList.remove('active');
        });
        const targetView = document.getElementById(`view-${viewId}`);
        if(targetView) targetView.classList.add('active');

        if (viewId === 'client-detail' && param) {
            this.currentClientId = param;
        }

        this.render();
    },

    openModal(modalId) {
        this.modals.forEach(m => m.classList.add('hidden'));
        document.getElementById(modalId).classList.remove('hidden');
        this.modalOverlay.classList.remove('hidden');
        
        // Auto-focus first input
        const firstInput = document.getElementById(modalId).querySelector('input');
        if(firstInput) setTimeout(() => firstInput.focus(), 100);
    },

    closeModals() {
        this.modalOverlay.classList.add('hidden');
        this.formAddClient.reset();
        this.formAddDebt.reset();
        this.formAddPayment.reset();
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount);
    },

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return new Intl.DateTimeFormat('es-DO', { 
            day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' 
        }).format(date);
    },

    // Handlers
    handleAddClient(e) {
        e.preventDefault();
        const name = document.getElementById('input-client-name').value;
        const phone = document.getElementById('input-client-phone').value;
        
        const newClient = {
            id: Date.now().toString(),
            name,
            phone,
            createdAt: Date.now()
        };
        
        DataStore.addClient(newClient);
        this.closeModals();
        this.render();
    },

    handleAddDebt(e) {
        e.preventDefault();
        const desc = document.getElementById('input-debt-desc').value;
        const amount = parseFloat(document.getElementById('input-debt-amount').value);
        
        DataStore.addTransaction({
            id: Date.now().toString(),
            clientId: this.currentClientId,
            type: 'DEBT',
            amount,
            desc,
            date: Date.now()
        });
        
        this.closeModals();
        this.render();
    },

    handleAddPayment(e) {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('input-payment-amount').value);
        const note = document.getElementById('input-payment-note').value || 'Abono en efectivo';
        
        DataStore.addTransaction({
            id: Date.now().toString(),
            clientId: this.currentClientId,
            type: 'PAYMENT',
            amount,
            desc: note,
            date: Date.now()
        });
        
        this.closeModals();
        this.render();
    },

    // Render logic
    render() {
        if (this.currentView === 'dashboard') this.renderDashboard();
        if (this.currentView === 'clients') this.renderClients();
        if (this.currentView === 'client-detail') this.renderClientDetail();
    },

    renderDashboard() {
        const totalDebt = DataStore.getTotalDebt();
        const clients = DataStore.getClients();
        
        document.getElementById('total-debt').textContent = this.formatCurrency(totalDebt);
        document.getElementById('total-clients').textContent = clients.length;

        // Recent Transactions
        const txs = DataStore.getTransactions().sort((a,b) => b.date - a.date).slice(0, 6);
        this.recentTxList.innerHTML = '';
        
        if (txs.length === 0) {
            this.recentTxList.innerHTML = '<p>No hay transacciones recientes.</p>';
            return;
        }

        txs.forEach(tx => {
            const client = clients.find(c => c.id === tx.clientId);
            const isDebt = tx.type === 'DEBT';
            const iconSvg = isDebt ? Icons.cart : Icons.check;
            const sign = isDebt ? '-' : '+';
            
            this.recentTxList.innerHTML += `
                <div class="transaction-item">
                    <div class="tx-left">
                        <div class="tx-icon ${isDebt ? 'tx-debt' : 'tx-payment'}">
                            ${iconSvg}
                        </div>
                        <div class="tx-details">
                            <h4>${client ? client.name : 'Desconocido'}</h4>
                            <p>${tx.desc} • ${this.formatDate(tx.date)}</p>
                        </div>
                    </div>
                    <div class="tx-amount ${isDebt ? 'negative' : 'positive'}">
                        ${sign}${this.formatCurrency(tx.amount)}
                    </div>
                </div>
            `;
        });
    },

    renderClients() {
        const clients = DataStore.getClients();
        this.clientsList.innerHTML = '';

        if (clients.length === 0) {
            this.clientsList.innerHTML = '<p>No tienes clientes registrados aún.</p>';
            return;
        }

        clients.forEach(client => {
            const balance = DataStore.getClientBalance(client.id);
            const initials = client.name.substring(0,2).toUpperCase();
            
            const card = document.createElement('div');
            card.className = 'client-card glass';
            card.innerHTML = `
                <div class="client-header">
                    <div class="avatar">${initials}</div>
                    <div>
                        <div class="client-name">${client.name}</div>
                        <div class="client-phone">${client.phone || 'Sin teléfono'}</div>
                    </div>
                </div>
                <div class="client-balance">
                    <span>Deuda Actual:</span>
                    <span class="balance-amount">${this.formatCurrency(balance)}</span>
                </div>
            `;
            
            card.addEventListener('click', () => this.navigate('client-detail', client.id));
            this.clientsList.appendChild(card);
        });
    },

    renderClientDetail() {
        const clients = DataStore.getClients();
        const client = clients.find(c => c.id === this.currentClientId);
        
        if (!client) return this.navigate('clients');

        document.getElementById('detail-client-name').textContent = client.name;
        
        const balance = DataStore.getClientBalance(client.id);
        document.getElementById('detail-client-debt').textContent = this.formatCurrency(balance);

        const historyList = document.getElementById('client-history-list');
        const txs = DataStore.getClientTransactions(client.id);
        
        historyList.innerHTML = '';
        if (txs.length === 0) {
            historyList.innerHTML = '<p>No hay historial para este cliente.</p>';
            return;
        }

        txs.forEach(tx => {
            const isDebt = tx.type === 'DEBT';
            const iconSvg = isDebt ? Icons.cart : Icons.check;
            const sign = isDebt ? '-' : '+';

            historyList.innerHTML += `
                <div class="transaction-item">
                    <div class="tx-left">
                        <div class="tx-icon ${isDebt ? 'tx-debt' : 'tx-payment'}">
                            ${iconSvg}
                        </div>
                        <div class="tx-details">
                            <h4>${tx.desc}</h4>
                            <p>${this.formatDate(tx.date)}</p>
                        </div>
                    </div>
                    <div class="tx-amount ${isDebt ? 'negative' : 'positive'}">
                        ${sign}${this.formatCurrency(tx.amount)}
                    </div>
                </div>
            `;
        });
    }
};

// Exponer la API para los módulos Fiados 2.0 cargados como scripts clásicos.
// Se mantienen las mismas clases/instancias; no se migra ni modifica el almacenamiento.
window.DataStore = DataStore;
window.App = App;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
