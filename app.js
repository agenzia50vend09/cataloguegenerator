const API_URL = "https://script.google.com/macros/s/AKfycbx778vC2rPCpLIHB7TnG1nsPUymQeUvKR_uNmfKYG-EzoO5-aTz-qkalxX1UXgObxZDFg/exec";

class CatalogApp {
    constructor() {
        this.products = [];
        this.credentials = [];
        this.adminPhone = ""; 
        this.currentView = { type: 'home', value: null }; 
        this.activeAdminTab = 'catalog'; 
        
        this.init();
    }

    async init() {
        await this.loadDataFromSheets();
        if (this.products && this.products.length > 0) {
            this.buildFilterMenus();
        }
        // Il rendering iniziale è gestito da checkAdminSession
        this.checkAdminSession();
    }

    async loadDataFromSheets() {
        try {
            const response = await fetch(`${API_URL}?_=${Date.now()}`);
            if (!response.ok) throw new Error("Risposta del server non valida");
            const data = await response.json();
            this.products = data.prodotti || [];
            this.credentials = data.credenziali || [];
            if (this.credentials.length > 0) {
                this.adminPhone = this.credentials[0].telefono || ""; 
            }
        } catch (error) {
            console.error("Errore caricamento:", error);
            this.loadMockData();
        }
    }

    async syncWithSheets(action, payload) {
        try {
            await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ action, data: payload })
            });
            await this.loadDataFromSheets();
            this.checkAdminSession();
        } catch (error) {
            alert("Errore di sincronizzazione.");
        }
    }

    isAdminActive() {
        return localStorage.getItem('isAdminSession') === 'true';
    }

    checkAdminSession() {
        const publicNav = document.getElementById('public-nav');
        const btnView = document.getElementById('admin-btn-view');
        const btnManage = document.getElementById('admin-btn-manage');
        const btnLogout = document.getElementById('admin-btn-logout');
        const adminPanel = document.getElementById('admin-panel');
        const catalogWrapper = document.getElementById('catalog-wrapper');
        const headerTools = document.querySelectorAll('#main-nav .dropdown, #main-nav .btn-success, #main-nav .btn-outline:not(#public-nav):not(#admin-btn-view):not(#admin-btn-manage)');

        if (this.isAdminActive()) {
            if (publicNav) publicNav.classList.add('hidden');
            if (btnView) btnView.classList.remove('hidden');
            if (btnManage) btnManage.classList.remove('hidden');
            if (btnLogout) btnLogout.classList.remove('hidden');
            headerTools.forEach(el => el.classList.remove('hidden'));

            if (this.activeAdminTab === 'catalog') {
                if (adminPanel) adminPanel.classList.add('hidden');
                if (catalogWrapper) catalogWrapper.classList.remove('hidden');
                this.render();
            } else {
                if (catalogWrapper) catalogWrapper.classList.add('hidden');
                if (adminPanel) adminPanel.classList.remove('hidden');
            }
            if (this.activeAdminTab === 'management') this.renderAdminTable();
        } else {
            if (publicNav) publicNav.classList.remove('hidden');
            if (btnView) btnView.classList.add('hidden');
            if (btnManage) btnManage.classList.add('hidden');
            if (btnLogout) btnLogout.classList.add('hidden');
            headerTools.forEach(el => el.classList.add('hidden'));
            if (adminPanel) adminPanel.classList.add('hidden');
            if (catalogWrapper) catalogWrapper.classList.add('hidden');
        }
    }

    switchAdminView(view) {
        this.activeAdminTab = view;
        this.checkAdminSession();
    }

    toggleAdminModal(show) {
        document.getElementById('login-modal').style.display = show ? 'flex' : 'none';
    }

    handleLogin(e) {
        e.preventDefault();
        const userIn = document.getElementById('username').value;
        const passIn = document.getElementById('password').value;
        if (this.credentials.find(c => c.username === userIn && c.password === passIn)) {
            localStorage.setItem('isAdminSession', 'true');
            this.toggleAdminModal(false);
            this.checkAdminSession();
        } else {
            alert("Credenziali errate.");
        }
    }

    handleLogout() {
        localStorage.removeItem('isAdminSession');
        this.checkAdminSession();
    }

    buildFilterMenus() {
        const types = ['gum', 'caramella', 'lollipop', 'gommose'];
        const packtypes = ['stick', 'box', 'monopezzo', 'lollipop', 'busta', 'bottle', 'expo'];
        document.getElementById('dropdown-type').innerHTML = types.map(t => `<a href="#" onclick="app.setFilter('type', '${t}')">${t}</a>`).join('');
        document.getElementById('dropdown-packtype').innerHTML = packtypes.map(p => `<a href="#" onclick="app.setFilter('packtype', '${p}')">${p}</a>`).join('');
    }

    setFilter(t, v) { this.currentView = { type: t, value: v }; this.switchAdminView('catalog'); }
    viewAllProducts() { this.currentView = { type: 'all', value: null }; this.switchAdminView('catalog'); }
    renderCatalog() { this.currentView = { type: 'home', value: null }; this.switchAdminView('catalog'); }

    exportPDF(target) {
        const hiddenArea = document.createElement('div');
        hiddenArea.style.position = 'absolute'; hiddenArea.style.left = '-9999px'; hiddenArea.style.width = '1200px'; hiddenArea.style.background = '#fff';
        document.body.appendChild(hiddenArea);
        
        const ordina = (l) => [...l].sort((a,b) => (String(b.novita)==='true') - (String(a.novita)==='true'));
        
        const novita = this.products.filter(p => String(p.novita) === 'true');
        if(novita.length) { hiddenArea.appendChild(this.createSectionHeading("✨ Novità")); hiddenArea.appendChild(this.createGrid(novita)); }
        
        [...new Set(this.products.map(p => p.brand))].forEach(brand => {
            hiddenArea.appendChild(this.createSectionHeading(brand));
            hiddenArea.appendChild(this.createGrid(ordina(this.products.filter(p => p.brand === brand))));
        });

        const imgs = Array.from(hiddenArea.querySelectorAll('img'));
        Promise.all(imgs.map(i => i.complete ? Promise.resolve() : new Promise(r => i.onload = i.onerror = r))).then(() => {
            setTimeout(() => {
                const opt = { margin: 15, filename: 'Catalogo.pdf', image: { type: 'jpeg', quality: 0.9 }, html2canvas: { scale: 1.5 }, jsPDF: { unit: 'px', format: [1200, hiddenArea.offsetHeight + 100] } };
                html2pdf().set(opt).from(hiddenArea).save().then(() => document.body.removeChild(hiddenArea));
            }, 500);
        });
    }

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;
        container.innerHTML = '';
        const ordina = (l) => [...l].sort((a,b) => (String(b.novita)==='true') - (String(a.novita)==='true'));
        
        if (this.currentView.type === 'home') {
            const novita = this.products.filter(p => String(p.novita) === 'true');
            if (novita.length) { container.appendChild(this.createSectionHeading("✨ Novità")); container.appendChild(this.createGrid(novita)); }
            [...new Set(this.products.map(p => p.brand))].forEach(b => {
                container.appendChild(this.createSectionHeading(b));
                container.appendChild(this.createGrid(ordina(this.products.filter(p => p.brand === b)).slice(0,3)));
            });
        } else {
            let list = this.currentView.type === 'all' ? this.products : this.products.filter(p => p[this.currentView.type] === this.currentView.value);
            container.appendChild(this.createSectionHeading("Risultati"));
            container.appendChild(this.createGrid(list));
        }
    }

    createSectionHeading(t) { const h = document.createElement('h2'); h.className = 'section-title'; h.innerText = t; return h; }
    
    createGrid(list) {
        const grid = document.createElement('div'); grid.className = 'grid-products';
        list.forEach(p => {
            const card = document.createElement('div'); card.className = 'product-card';
            card.innerHTML = `<img src="${p.foto || ''}" onerror="this.src='data:image/svg+xml,...'"> 
                             <div class="product-info"><strong>${p.brand}</strong><br>${p.nome}<br>${p.prezzo}€</div>`;
            grid.appendChild(card);
        });
        return grid;
    }

    renderAdminTable() {
        document.getElementById('admin-table-body').innerHTML = this.products.map(p => `<tr><td>${p.id}</td><td>${p.nome}</td><td><button onclick="app.loadProductIntoForm('${p.id}')">Modifica</button></td></tr>`).join('');
    }

    loadProductIntoForm(id) { /* Logica form... */ }
    loadMockData() { this.products = [{id: "1", brand: "Test", nome: "Prodotto", prezzo: 0}]; this.render(); }
}
const app = new CatalogApp();
