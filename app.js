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
        this.checkAdminSession();
    }

    async loadData() {
        try {
            const res = await fetch(`${API_URL}?_=${Date.now()}`);
            const data = await res.json();
            this.products = data.prodotti || [];
            this.credentials = data.credenziali || [];
        } catch (e) { console.error("Errore dati", e); }
    }

    isAdminActive() { return localStorage.getItem('isAdminSession') === 'true'; }

    checkAdminSession() {
        const isAuth = this.isAdminActive();
        const nav = document.getElementById('public-nav');
        const bar = document.getElementById('controls-bar');
        const wrap = document.getElementById('catalog-wrapper');
        const pan = document.getElementById('admin-panel');

        nav.style.display = isAuth ? 'none' : 'block';
        bar.style.display = isAuth ? 'flex' : 'none';
        wrap.style.display = (isAuth && this.activeAdminTab === 'catalog') ? 'block' : 'none';
        pan.style.display = (isAuth && this.activeAdminTab === 'management') ? 'block' : 'none';

        if(isAuth && this.activeAdminTab === 'catalog') this.render();
    }

    // Questa funzione corregge i link Drive per renderli visibili
    getPhotoUrl(url) {
        if (!url || url.trim() === "") return 'https://via.placeholder.com/100?text=No+Foto';
        let u = url.trim();
        if (u.includes("drive.google.com/file/d/")) {
            const id = u.split("/d/")[1].split("/")[0];
            return `https://lh3.googleusercontent.com/d/${id}=s400`;
        }
        return u;
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
            <div style="border:1px solid #ddd; margin:10px; padding:10px; display:inline-block; width:150px;">
                <img src="${this.getPhotoUrl(p.foto)}" style="width:100%; height:100px; object-fit:contain;">
                <div><strong>${p.brand}</strong><br>${p.nome}<br>${p.prezzo}€</div>
            </div>
        `).join('');
    }

    switchAdminView(v) { this.activeAdminTab = v; this.checkAdminSession(); }
    renderCatalog() { this.activeAdminTab = 'catalog'; this.checkAdminSession(); }
    toggleAdminModal(s) { document.getElementById('login-modal').style.display = s ? 'flex' : 'none'; }
    exportPDF() { html2pdf().from(document.getElementById('main-content')).save(); }
}

const app = new CatalogApp();
