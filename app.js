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

    // --- LOGICA GRAFICA ORIGINALE ---
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
            container.appendChild(this.createSectionHeading("Catalogo"));
            container.appendChild(this.createGrid(this.products));
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
                <div class="product-img-container"><img src="${this.getPhotoUrl(prod.foto)}" onerror="this.src='data:image/svg+xml,...'"></div>
                <div class="product-info">
                    <div class="product-brand">${prod.brand}</div>
                    <div class="product-name">${prod.nome}</div>
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

    // --- FUNZIONI DI CONTROLLO ---
    exportPDF(target) {
        const opt = { margin: 10, filename: 'Catalogo.pdf', html2canvas: { scale: 2 } };
        html2pdf().set(opt).from(document.getElementById('main-content')).save();
    }

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
    switchAdminView(v) { this.activeAdminTab = v; this.checkAdminSession(); }
    renderCatalog() { this.currentView.type = 'home'; this.activeAdminTab = 'catalog'; this.checkAdminSession(); }
    toggleAdminModal(s) { document.getElementById('login-modal').style.display = s ? 'flex' : 'none'; }
    buildFilterMenus() { /* Mantieni la tua logica originale qui */ }
}

const app = new CatalogApp();
