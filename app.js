// --- CONFIGURAZIONE WEB APP GOOGLE SHEETS ---
const API_URL = "https://script.google.com/macros/s/AKfycbx778vC2rPCpLIHB7TnG1nsPUymQeUvKR_uNmfKYG-EzoO5-aTz-qkalxX1UXgObxZDFg/exec";

class CatalogApp {
    constructor() {
        this.products = [];
        this.credentials = [];
        this.currentUserPhone = ""; // Memorizza il cellulare dell'admin loggato
        this.init();
    }

    async init() {
        await this.loadDataFromSheets();
        this.checkAdminSession();
    }

    async loadDataFromSheets() {
        try {
            const response = await fetch(`${API_URL}?_=${Date.now()}`);
            if (!response.ok) throw new Error("Risposta del server non valida");
            
            const data = await response.json();
            this.products = data.prodotti || [];
            this.credentials = data.credenziali || [];
        } catch (error) {
            console.error("Errore nel caricamento dati da Google Sheets:", error);
            alert("Impossibile connettersi al database di Google Fogli. Verranno usati dati locali simulati.");
            this.loadMockData();
        }
    }

    async syncWithSheets(action, payload) {
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ action, data: payload })
            });
            
            await this.loadDataFromSheets();
            if (this.isAdminActive()) {
                this.renderAdminTable();
            }
        } catch (error) {
            console.error("Errore di sincronizzazione:", error);
            alert("Si è verificato un errore durante il salvataggio dei dati su Google Fogli.");
        }
    }

    isAdminActive() {
        return localStorage.getItem('isAdminSession') === 'true';
    }

    checkAdminSession() {
        const adminPanel = document.getElementById('admin-panel');
        const adminGateBtn = document.getElementById('btn-admin-gate');
        const mainContent = document.getElementById('main-content');

        if (this.isAdminActive()) {
            if (adminPanel) adminPanel.classList.remove('hidden');
            if (adminGateBtn) adminGateBtn.innerHTML = '<i class="fa-solid fa-unlock"></i> Pannello Aperto';
            if (mainContent) mainContent.innerHTML = '<p style="text-align:center; color:var(--primary-blue); font-weight:600;">Accesso Admin Eseguito. Gestisci il catalogo e genera i PDF dalle sezioni sottostanti.</p>';
            this.currentUserPhone = localStorage.getItem('adminPhone') || "";
            this.renderAdminTable();
        } else {
            if (adminPanel) adminPanel.classList.add('hidden');
            if (adminGateBtn) adminGateBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Admin';
            if (mainContent) mainContent.innerHTML = '<h2 style="text-align:center; margin-top:40px; color:var(--gray-text);">Benvenuto. Catalogo privato, effettua il login amministratore per procedere.</h2>';
        }
    }

    toggleAdminModal(show) {
        const modal = document.getElementById('login-modal');
        if (modal) modal.style.display = show ? 'flex' : 'none';
    }

    handleLogin(e) {
        e.preventDefault();
        const userIn = document.getElementById('username').value;
        const passIn = document.getElementById('password').value;

        // Cerca la corrispondenza includendo il nuovo campo cellulare richiesto
        const account = this.credentials.find(c => c.username === userIn && c.password === passIn);

        if (account) {
            localStorage.setItem('isAdminSession', 'true');
            // Salviamo il cellulare recuperato dal foglio Google credenziali
            localStorage.setItem('adminPhone', account.cellulare || "");
            this.currentUserPhone = account.cellulare || "";
            
            this.toggleAdminModal(false);
            this.checkAdminSession();
            document.getElementById('login-form').reset();
        } else {
            alert("Credenziali non valide. Riprova.");
        }
    }

    handleLogout() {
        localStorage.removeItem('isAdminSession');
        localStorage.removeItem('adminPhone');
        this.currentUserPhone = "";
        this.checkAdminSession();
    }

    getPhotoUrl(photoData) {
        if (!photoData || photoData.trim() === "" || photoData.startsWith('photo_')) {
            return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3C/svg%3E';
        }
        let url = photoData.trim();
        if (url.includes("drive.google.com")) {
            let matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
            if (matches && matches[1]) {
                return `https://lh3.googleusercontent.com/d/${matches[1]}`;
            }
        }
        return url;
    }

    handleUrlPreview(url) {
        const previewContainer = document.getElementById('photo-preview-container');
        const previewImg = document.getElementById('photo-preview');
        if (url && url.trim() !== "") {
            if (previewImg) previewImg.src = this.getPhotoUrl(url);
            if (previewContainer) previewContainer.classList.remove('hidden');
        } else {
            if (previewContainer) previewContainer.classList.add('hidden');
        }
    }

    // --- LOGICA DI ORDINAMENTO STRUTTURATA (VECCHIO CATALOGO PUBBLICO) ---
    getOrderedProductsStructure() {
        const ordinaPerNovita = (lista) => {
            return [...lista].sort((a, b) => {
                const aNovita = String(a.novita) === 'true' ? 1 : 0;
                const bNovita = String(b.novita) === 'true' ? 1 : 0;
                return bNovita - aNovita; 
            });
        };

        const novitaGenerali = this.products.filter(p => String(p.novita) === 'true');
        const brands = [...new Set(this.products.map(p => p.brand))];
        const strutturaBrand = {};

        brands.forEach(brand => {
            const prodottiDelBrand = this.products.filter(p => p.brand === brand);
            // Ordina inserendo la novità in testa per ciascun brand
            strutturaBrand[brand] = ordinaPerNovita(prodottiDelBrand);
        });

        return { novitaGenerali, strutturaBrand };
    }

    // --- GENERATORE DI CATALOGO PDF E FUNZIONE WHATSAPP ---
    

    // --- GESTIONE DATI TABELLA ADMIN ---
    renderAdminTable() {
        const tbody = document.getElementById('admin-table-body');
        if (!tbody) return;
        
        if (!this.products || this.products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Nessun dato disponibile</td></tr>`;
            return;
        }

        tbody.innerHTML = this.products.map(p => {
            const photoUrl = this.getPhotoUrl(p.foto);
            return `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td><img src="${photoUrl}" style="width:40px; height:40px; object-fit:contain; border-radius:4px;" onerror="this.onerror=null;this.src=''"></td>
                <td>${p.brand}</td>
                <td>${p.nome}</td>
                <td>${parseFloat(p.prezzo || 0).toFixed(2)}€</td>
                <td>
                    <div class="admin-actions-btns">
                        <button type="button" class="btn-outline" style="padding:5px 10px; font-size:12px;" onclick="app.loadProductIntoForm('${p.id}')"><i class="fa-solid fa-pen"></i> Modifica</button>
                        <button type="button" class="btn-danger" style="padding:5px 10px; font-size:12px;" onclick="app.deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `}).join('');
    }

    handleProductSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const fotoValue = document.getElementById('prod-foto').value;
        
        if (!fotoValue || fotoValue.trim() === "") {
            alert('Inserisci un URL valido per la foto.');
            return;
        }
        
        const inputPrezzo = document.getElementById('prod-prezzo').value;
        const parsedPrezzo = parseFloat(inputPrezzo);

        if (isNaN(parsedPrezzo)) {
            alert('Inserisci un prezzo valido.');
            return;
        }

        const productData = {
            id: id || 'P' + Date.now().toString().slice(-6),
            brand: document.getElementById('prod-brand').value,
            nome: document.getElementById('prod-nome').value,
            descrizione: document.getElementById('prod-descrizione').value,
            prezzo: parsedPrezzo, 
            disponibile: String(document.getElementById('prod-disponibile').checked),
            novita: String(document.getElementById('prod-novita').checked),
            type: document.getElementById('prod-type').value,
            packtype: document.getElementById('prod-packtype').value,
            foto: fotoValue.trim()
        };

        if (id) {
            this.syncWithSheets('update', productData);
        } else {
            this.syncWithSheets('create', productData);
        }

        this.resetProductForm();
    }

    loadProductIntoForm(id) {
        const prod = this.products.find(p => String(p.id) === String(id));
        if(!prod) return;

        document.getElementById('form-title').innerText = "Modifica Prodotto #" + prod.id;
        document.getElementById('prod-id').value = prod.id;
        document.getElementById('prod-brand').value = prod.brand;
        document.getElementById('prod-nome').value = prod.nome;
        document.getElementById('prod-descrizione').value = prod.descrizione;
        document.getElementById('prod-prezzo').value = parseFloat(prod.prezzo || 0);
        
        document.getElementById('prod-disponibile').checked = String(prod.disponibile) === 'true';
        document.getElementById('prod-novita').checked = String(prod.novita) === 'true';
        document.getElementById('prod-type').value = prod.type;
        document.getElementById('prod-packtype').value = prod.packtype;
        document.getElementById('prod-foto').value = prod.foto;
        this.handleUrlPreview(prod.foto);

        const cancelBtn = document.getElementById('btn-cancel-edit');
        const saveBtn = document.getElementById('btn-save');
        if (cancelBtn) cancelBtn.classList.remove('hidden');
        if (saveBtn) saveBtn.innerText = "Aggiorna Prodotto";
        
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) {
            window.scrollTo({top: adminPanel.offsetTop, behavior: 'smooth'});
        }
    }

    deleteProduct(id) {
        if(confirm(`Sei sicuro di voler eliminare il prodotto ID #${id}?`)) {
            this.syncWithSheets('delete', { id: id });
        }
    }

    resetProductForm() {
        const form = document.getElementById('product-form');
        if (form) form.reset();
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-foto').value = '';
        document.getElementById('form-title').innerText = "Aggiungi Nuovo Prodotto";
        document.getElementById('btn-save').innerText = "Salva Prodotto";
        
        const cancelBtn = document.getElementById('btn-cancel-edit');
        const previewContainer = document.getElementById('photo-preview-container');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        if (previewContainer) previewContainer.classList.add('hidden');
    }

    loadMockData() {
        this.credentials = [{username: "admin", password: "password", cellulare: "+393331234567"}];
        this.products = [
            {id: "1", brand: "Frizz", nome: "Goleador Cola", descrizione: "Caramelle gommose frizzanti.", prezzo: 0.20, disponibile: "true", novita: "true", packtype: "monopezzo", type: "gommose", foto: ""},
            {id: "3", brand: "Chupa", nome: "Chupa Chups Fragola", descrizione: "Il lollipop più famoso.", prezzo: 0.50, disponibile: "true", novita: "true", packtype: "lollipop", type: "lollipop", foto: ""}
        ];
        this.renderAdminTable();
    }
}

const app = new CatalogApp();
