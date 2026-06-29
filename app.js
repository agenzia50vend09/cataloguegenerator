const API_URL = "https://script.google.com/macros/s/AKfycbx778vC2rPCpLIHB7TnG1nsPUymQeUvKR_uNmfKYG-EzoO5-aTz-qkalxX1UXgObxZDFg/exec";

class CatalogApp {
    constructor() {
        this.products = [];
        this.credentials = [];
        this.activeAdminTab = 'catalog';
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
        } catch (e) { console.error(e); }
    }

    isAdminActive() { return localStorage.getItem('isAdminSession') === 'true'; }

    checkAdminSession() {
        const isAuth = this.isAdminActive();
        // Gestione visibilità base
        document.getElementById('public-nav').style.display = isAuth ? 'none' : 'block';
        document.getElementById('controls-bar').style.display = isAuth ? 'flex' : 'none';
        document.getElementById('catalog-wrapper').style.display = (isAuth && this.activeAdminTab === 'catalog') ? 'block' : 'none';
        document.getElementById('admin-panel').style.display = (isAuth && this.activeAdminTab === 'management') ? 'block' : 'none';
        
        if(isAuth && this.activeAdminTab === 'catalog') this.render();
    }

    getPhotoUrl(url) {
        if (!url) return '';
        // Gestione link Drive
        if (url.includes("drive.google.com")) {
            const id = url.split("/d/")[1]?.split("/")[0];
            return id ? `https://lh3.googleusercontent.com/d/${id}` : url;
        }
        return url;
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

    render() {
        const container = document.getElementById('main-content');
        container.innerHTML = this.products.map(p => `
            <div class="product-card" style="border:1px solid #ccc; margin:10px; padding:10px;">
                <img src="${this.getPhotoUrl(p.foto)}" style="width:100px; height:100px; object-fit:cover;">
                <div><strong>${p.brand}</strong><br>${p.nome} - ${p.prezzo}€</div>
            </div>
        `).join('');
    }

    buildFilterMenus() {
        ['gum', 'caramella'].forEach(t => {
            const a = document.createElement('a'); a.innerText = t; a.href = "#";
            a.onclick = () => alert("Filtro: " + t);
            document.getElementById('dropdown-type').appendChild(a);
        });
    }

    switchAdminView(v) { this.activeAdminTab = v; this.checkAdminSession(); }
    renderCatalog() { this.activeAdminTab = 'catalog'; this.checkAdminSession(); }
    toggleAdminModal(s) { document.getElementById('login-modal').style.display = s ? 'flex' : 'none'; }
    exportPDF(target) { html2pdf().from(document.getElementById('main-content')).save(); }
}
const app = new CatalogApp();
