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
        } catch (e) { this.loadMockData(); }
    }

    isAdminActive() { return localStorage.getItem('isAdminSession') === 'true'; }

    checkAdminSession() {
        const isAuth = this.isAdminActive();
        document.getElementById('public-nav').classList.toggle('hidden', isAuth);
        document.getElementById('controls-bar').classList.toggle('hidden', !isAuth);
        document.getElementById('catalog-wrapper').classList.toggle('hidden', !isAuth || this.activeAdminTab !== 'catalog');
        document.getElementById('admin-panel').classList.toggle('hidden', !isAuth || this.activeAdminTab !== 'management');
        if(isAuth && this.activeAdminTab === 'catalog') this.render();
    }

    getPhotoUrl(url) {
        if (!url) return '';
        if (url.includes("drive.google.com")) {
            const id = url.split("/d/")[1]?.split("/")[0];
            return id ? `https://lh3.googleusercontent.com/d/${id}=s400` : url;
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
        } else alert("Errore");
    }

    handleLogout() { localStorage.removeItem('isAdminSession'); location.reload(); }

    switchAdminView(v) { this.activeAdminTab = v; this.checkAdminSession(); }

    render() {
        const container = document.getElementById('main-content');
        container.innerHTML = this.products.map(p => `
            <div class="product-card">
                <img src="${this.getPhotoUrl(p.foto)}" onerror="this.src=''">
                <div><strong>${p.brand}</strong><br>${p.nome}<br>${p.prezzo}€</div>
            </div>
        `).join('');
    }

    buildFilterMenus() {
        ['gum', 'caramella'].forEach(t => {
            const a = document.createElement('a'); a.innerText = t;
            a.onclick = () => alert(t);
            document.getElementById('dropdown-type').appendChild(a);
        });
    }

    exportPDF(target) {
        alert("Generazione PDF...");
        const opt = { margin: 10, filename: 'Catalogo.pdf', html2canvas: { scale: 2 } };
        html2pdf().set(opt).from(document.getElementById('main-content')).save();
    }
}
const app = new CatalogApp();
