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
        } catch (e) { console.error("Errore caricamento:", e); }
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

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;
        container.innerHTML = '';

        const ordinaPerNovita = (l) => [...l].sort((a, b) => (String(b.novita) === 'true') - (String(a.novita) === 'true'));

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
            let list = this.products.filter(p => p[this.currentView.type] === this.currentView.value);
            container.appendChild(this.createSectionHeading(this.currentView.value));
            container.appendChild(this.createGrid(list));
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
        list.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                ${String(p.novita) === 'true' ? '<div class="badge-novita">Novità</div>' : ''}
                <div class="product-img-container"><img src="${this.getPhotoUrl(p.foto)}" onerror="this.src='data:image/svg+xml,...'"></div>
                <div class="product-info">
                    <div class="product-brand">${p.brand}</div>
                    <div class="product-name">${p.nome}</div>
                    <div class="product-desc">${p.descrizione || ''}</div>
                    <div class="product-meta">
                        <span><i class="fa-solid fa-boxes-stacked"></i> ${p.packtype || 'N/D'}</span>
                        <span><i class="fa-solid fa-tag"></i> ${p.type || 'N/D'}</span>
                    </div>
                    <div class="product-price">${parseFloat(p.prezzo || 0).toFixed(2)}€</div>
                </div>`;
            grid.appendChild(card);
        });
        return grid;
    }

    getPhotoUrl(url) {
        if (!url) return '';
        const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
        return matches ? `https://lh3.googleusercontent.com/d/${matches[1]}=s400` : url;
    }

    async exportPDF() {
        const container = document.getElementById('main-content');
        const backup = container.innerHTML;

        container.innerHTML = '';
        [...new Set(this.products.map(p => p.brand))].forEach(brand => {
            container.appendChild(this.createSectionHeading(brand));
            container.appendChild(this.createGrid(this.products.filter(p => p.brand === brand)));
        });

        const images = container.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => new Promise(r => { img.onload = img.onerror = r; })));

        const opt = {
            margin: 10, filename: 'Catalogo.pdf',
            image: { type: 'jpeg', quality: 0.9 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'avoid', before: '.section-title' }
        };

        await html2pdf().set(opt).from(container).save();
        container.innerHTML = backup;
    }

    buildFilterMenus() {
        const types = ['gum', 'caramella', 'lollipop', 'gommose'];
        const packs = ['stick', 'box', 'monopezzo', 'lollipop', 'busta', 'bottle', 'expo'];
        const tMenu = document.getElementById('dropdown-type');
        const pMenu = document.getElementById('dropdown-packtype');
        types.forEach(t => tMenu.innerHTML += `<a href="#" onclick="app.setFilter('type', '${t}')">${t}</a>`);
        packs.forEach(p => pMenu.innerHTML += `<a href="#" onclick="app.setFilter('packtype', '${p}')">${p}</a>`);
    }

    setFilter(t, v) { this.currentView = { type: t, value: v }; this.render(); }
    renderCatalog() { this.currentView.type = 'home'; this.render(); }
    switchAdminView(v) { this.activeAdminTab = v; this.checkAdminSession(); }
    handleLogin(e) {
        e.preventDefault();
        const u = document.getElementById('username').value, p = document.getElementById('password').value;
        if(this.credentials.find(c => c.username === u && c.password === p)) {
            localStorage.setItem('isAdminSession', 'true');
            document.getElementById('login-modal').style.display = 'none';
            this.checkAdminSession();
        } else alert("Credenziali errate");
    }
    handleLogout() { localStorage.removeItem('isAdminSession'); location.reload(); }
    toggleAdminModal(s) { document.getElementById('login-modal').style.display = s ? 'flex' : 'none'; }
}
const app = new CatalogApp();
