const API_URL = "https://script.google.com/macros/s/AKfycbx778vC2rPCpLIHB7TnG1nsPUymQeUvKR_uNmfKYG-EzoO5-aTz-qkalxX1UXgObxZDFg/exec";

class CatalogApp {
    constructor() {
        this.products = [];
        this.credentials = [];
        this.activeAdminTab = 'catalog';
        this.currentView = { type: 'home', value: null };
        this.init();
    }

    async init() {
        await this.loadData();
        this.buildFilterMenus();
        this.checkAdminSession();
    }

    async loadData() {
        try {
            const res = await fetch(`${API_URL}?_=${Date.now()}`);
            const data = await res.json();
            this.products = data.prodotti || [];
            this.credentials = data.credenziali || [];
        } catch (e) { console.error("Errore caricamento", e); }
    }

    isAdminActive() { return localStorage.getItem('isAdminSession') === 'true'; }

    checkAdminSession() {
        const isAuth = this.isAdminActive();
        document.getElementById('public-nav').style.display = isAuth ? 'none' : 'block';
        document.getElementById('controls-bar').style.display = isAuth ? 'flex' : 'none';
        document.getElementById('catalog-wrapper').style.display = (isAuth && this.activeAdminTab === 'catalog') ? 'block' : 'none';
        document.getElementById('admin-panel').style.display = (isAuth && this.activeAdminTab === 'management') ? 'block' : 'none';

        if(isAuth && this.activeAdminTab === 'catalog') this.render();
    }

    // --- RENDERING CON TUTTI I DETTAGLI ORIGINALI ---
    render() {
        const container = document.getElementById('main-content');
        if (!container) return;
        container.innerHTML = '';

        const ordinaPerNovita = (lista) => [...lista].sort((a, b) => (String(b.novita) === 'true') - (String(a.novita) === 'true'));

        if (this.currentView.type === 'home') {
            const novita = this.products.filter(p => String(p.novita) === 'true');
            if (novita.length) {
                container.appendChild(this.createSectionHeading("✨ Novità In Evidenza"));
                container.appendChild(this.createGrid(novita));
            }
            [...new Set(this.products.map(p => p.brand))].forEach(brand => {
                const prodotti = this.products.filter(p => p.brand === brand);
                container.appendChild(this.createSectionHeading(brand));
                container.appendChild(this.createGrid(ordinaPerNovita(prodotti).slice(0, 3)));
            });
        } else {
            // Gestione filtri (Tipologia, Packtype, etc)
            let filteredList = this.products;
            if (this.currentView.type === 'type') filteredList = this.products.filter(p => p.type === this.currentView.value);
            if (this.currentView.type === 'packtype') filteredList = this.products.filter(p => p.packtype === this.currentView.value);
            
            container.appendChild(this.createSectionHeading(this.currentView.value || "Catalogo"));
            container.appendChild(this.createGrid(filteredList));
        }
    }

    createSectionHeading(text) {
        const h2 = document.createElement('h2');
        h2.className = 'section-title';
        h2.innerText = text;
        return h2;
    }

    createGrid(list) {
        const grid = document.createElement('div');
        grid.className = 'grid-products';
        list.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                ${String(prod.novita) === 'true' ? '<div class="badge-novita">Novità</div>' : ''}
                <div class="product-img-container"><img src="${this.getPhotoUrl(prod.foto)}" onerror="this.src='data:image/svg+xml,...'"></div>
                <div class="product-info">
                    <div class="product-brand">${prod.brand}</div>
                    <div class="product-name">${prod.nome}</div>
                    <div class="product-desc">${prod.descrizione || ''}</div>
                    <div class="product-meta">
                        <span><i class="fa-solid fa-boxes-stacked"></i> ${prod.packtype}</span>
                        <span>🏷️ ${prod.type}</span>
                    </div>
                    <div class="product-price">${parseFloat(prod.prezzo || 0).toFixed(2)}€</div>
                </div>`;
            grid.appendChild(card);
        });
        return grid;
    }

    getPhotoUrl(url) {
        if (!url) return '';
        if (url.includes("drive.google.com")) {
            const id = url.split("/d/")[1]?.split("/")[0];
            return `https://lh3.googleusercontent.com/d/${id}=s400`;
        }
        return url;
    }

    // --- FILTRI E AZIONI ---
    buildFilterMenus() {
        const types = ['gum', 'caramella', 'lollipop', 'gommose'];
        const packtypes = ['stick', 'box', 'monopezzo', 'lollipop', 'busta', 'bottle', 'expo'];
        
        const typeMenu = document.getElementById('dropdown-type');
        const packMenu = document.getElementById('dropdown-packtype');
        
        types.forEach(t => typeMenu.innerHTML += `<a href="#" onclick="app.setFilter('type', '${t}')">${t}</a>`);
        packtypes.forEach(p => packMenu.innerHTML += `<a href="#" onclick="app.setFilter('packtype', '${p}')">${p}</a>`);
    }

    setFilter(t, v) { this.currentView = { type: t, value: v }; this.render(); }
    renderCatalog() { this.currentView.type = 'home'; this.render(); }
    switchAdminView(v) { this.activeAdminTab = v; this.checkAdminSession(); }
    
    // --- LOGIN E LOGOUT ---
    handleLogin(e) {
        e.preventDefault();
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        if(this.credentials.find(c => c.username === u && c.password === p)) {
            localStorage.setItem('isAdminSession', 'true');
            document.getElementById('login-modal').style.display = 'none';
            this.checkAdminSession();
        } else alert("Credenziali errate");
    }

    handleLogout() { localStorage.removeItem('isAdminSession'); location.reload(); }
    toggleAdminModal(s) { document.getElementById('login-modal').style.display = s ? 'flex' : 'none'; }
    exportPDF() { html2pdf().from(document.getElementById('main-content')).save(); }
}

const app = new CatalogApp();
