const API_URL = "https://script.google.com/macros/s/AKfycbx778vC2rPCpLIHB7TnG1nsPUymQeUvKR_uNmfKYG-EzoO5-aTz-qkalxX1UXgObxZDFg/exec";

class CatalogApp {
    constructor() {
        this.products = [];
        this.credentials = [];
        this.adminPhone = ""; 
        this.currentView = { type: 'home', value: null }; 
        this.activeAdminTab = 'catalog'; // 'catalog' oppure 'management'
        
        this.init();
    }

    async init() {
        await this.loadDataFromSheets();
        
        if (this.products && this.products.length > 0) {
            this.buildFilterMenus();
            this.render();
        }

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
                const firstCred = this.credentials[0];
                const keys = Object.keys(firstCred);
                this.adminPhone = firstCred[keys[2]] || ""; 
            }
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
            this.render();
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
        const publicNav = document.getElementById('public-nav');
        const adminNav = document.getElementById('admin-nav');
        const adminPanel = document.getElementById('admin-panel');
        const catalogWrapper = document.getElementById('catalog-wrapper');

        if (this.isAdminActive()) {
            if (publicNav) publicNav.classList.add('hidden');
            if (adminNav) adminNav.classList.remove('hidden');
            this.switchAdminView(this.activeAdminTab);
            this.renderAdminTable();
        } else {
            if (publicNav) publicNav.classList.remove('hidden');
            if (adminNav) adminNav.classList.add('hidden');
            if (adminPanel) adminPanel.classList.add('hidden');
            if (catalogWrapper) catalogWrapper.classList.add('hidden');
        }
    }

    switchAdminView(view) {
        this.activeAdminTab = view;
        const adminPanel = document.getElementById('admin-panel');
        const catalogWrapper = document.getElementById('catalog-wrapper');
        const catalogElements = document.querySelectorAll('.view-catalog-el');

        if (view === 'catalog') {
            if (adminPanel) adminPanel.classList.add('hidden');
            if (catalogWrapper) catalogWrapper.classList.remove('hidden');
            catalogElements.forEach(el => el.classList.remove('hidden'));
            this.render();
        } else if (view === 'management') {
            if (catalogWrapper) catalogWrapper.classList.add('hidden');
            if (adminPanel) adminPanel.classList.remove('hidden');
            catalogElements.forEach(el => el.classList.add('hidden'));
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

        const matchedAdmin = this.credentials.find(c => c.username === userIn && c.password === passIn);

        if (matchedAdmin) {
            localStorage.setItem('isAdminSession', 'true');
            const keys = Object.keys(matchedAdmin);
            this.adminPhone = matchedAdmin[keys[2]] || ""; 
            this.toggleAdminModal(false);
            this.activeAdminTab = 'catalog'; 
            this.checkAdminSession();
            document.getElementById('login-form').reset();
        } else {
            alert("Credenziali non valide. Riprova.");
        }
    }

    handleLogout() {
        localStorage.removeItem('isAdminSession');
        this.activeAdminTab = 'catalog';
        this.checkAdminSession();
    }

    buildFilterMenus() {
        const types = ['gum', 'caramella', 'lollipop', 'gommose'];
        const packtypes = ['stick', 'box', 'monopezzo', 'lollipop', 'busta', 'bottle', 'expo'];

        const typeContainer = document.getElementById('dropdown-type');
        if (typeContainer) {
            typeContainer.innerHTML = types.map(t => `<a href="#" onclick="app.setFilter('type', '${t}')">${t}</a>`).join('');
        }

        const packContainer = document.getElementById('dropdown-packtype');
        if (packContainer) {
            packContainer.innerHTML = packtypes.map(p => `<a href="#" onclick="app.setFilter('packtype', '${p}')">${p}</a>`).join('');
        }
    }

    setFilter(filterType, value) {
        this.currentView = { type: filterType, value: value };
        this.render();
    }

    viewAllProducts() {
        this.currentView = { type: 'all', value: null };
        this.render();
    }

    renderCatalog() {
        this.currentView = { type: 'home', value: null };
        this.render();
    }

    exportPDF(target) {
        const element = document.getElementById('main-content');
        
        // Calcolo altezza per generare una pagina continua virtuale senza interruzioni
        const elementHeight = element.offsetHeight;
        const reportWidthPx = 1200; 
        const reportHeightPx = elementHeight + 100; 

        const opt = {
            margin: 10,
            filename: 'Catalogo_Sweets.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'px', format: [reportWidthPx, reportHeightPx], orientation: 'portrait' }
        };

        if (target === 'download') {
            html2pdf().set(opt).from(element).save();
        } else if (target === 'whatsapp') {
            html2pdf().set(opt).from(element).save();
            
            setTimeout(() => {
                if(!this.adminPhone) {
                    alert("Numero dell'admin non trovato nel database fogli.");
                    return;
                }
                const cleanPhone = this.adminPhone.replace(/\D/g, '');
                const text = encodeURIComponent("Ciao Admin! Il tuo PDF continuo è pronto ed è stato scaricato sul dispositivo. Trascinalo qui per inviarlo.");
                window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
            }, 1500);
        }
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

    getPhotoUrl(photoData) {
        if (!photoData || photoData.trim() === "" || photoData.startsWith('photo_')) {
            return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext x="50%" y="50%" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle" dy=".3em"%3ENessuna foto%3C/text%3E%3C/svg%3E';
        }

        let url = photoData.trim();

        if (url.includes("drive.google.com")) {
            let matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
            if (matches && matches[1]) {
                return `https://lh3.googleusercontent.com/u/0/d/${matches[1]}`;
            }
        }
        return url;
    }

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;
        container.innerHTML = ''; 

        const ordinaPerNovita = (lista) => {
            return [...lista].sort((a, b) => {
                const aNovita = String(a.novita) === 'true' ? 1 : 0;
                const bNovita = String(b.novita) === 'true' ? 1 : 0;
                return bNovita - aNovita;
            });
        };

        if (this.currentView.type === 'home') {
            const novitaProducts = this.products.filter(p => String(p.novita) === 'true');
            if (novitaProducts.length > 0) {
                container.appendChild(this.createSectionHeading("✨ Novità In Evidenza"));
                container.appendChild(this.createGrid(novitaProducts));
            }

            const brands = [...new Set(this.products.map(p => p.brand))];
            
            brands.forEach(brand => {
                const tuttiIProdottiDelBrand = this.products.filter(p => p.brand === brand);
                const brandProducts = ordinaPerNovita(tuttiIProdottiDelBrand).slice(0, 3);
                
                const headingEl = document.createElement('h2');
                headingEl.className = 'section-title';
                headingEl.innerHTML = `<span class="brand-title" onclick="app.setFilter('brand', '${brand}')">${brand} »</span>`;
                
                container.appendChild(headingEl);
                container.appendChild(this.createGrid(brandProducts));
            });
        } 
        else {
            let filteredList = [];
            let titleText = "";
            const listaGlobaleOrdinata = ordinaPerNovita(this.products);

            switch(this.currentView.type) {
                case 'all':
                    filteredList = listaGlobaleOrdinata;
                    titleText = "Tutto il Catalogo Prodotti";
                    break;
                case 'brand':
                    filteredList = listaGlobaleOrdinata.filter(p => p.brand === this.currentView.value);
                    titleText = `Prodotti del Brand: ${this.currentView.value}`;
                    break;
                case 'type':
                    filteredList = listaGlobaleOrdinata.filter(p => p.type === this.currentView.value);
                    titleText = `Categoria: ${this.currentView.value}`;
                    break;
                case 'packtype':
                    filteredList = listaGlobaleOrdinata.filter(p => p.packtype === this.currentView.value);
                    titleText = `Confezione: ${this.currentView.value}`;
                    break;
            }

            container.appendChild(this.createSectionHeading(titleText));
            container.appendChild(this.createGrid(filteredList));
        }
    }

    createSectionHeading(text) {
        const h2 = document.createElement('h2');
        h2.className = 'section-title';
        h2.innerText = text;
        return h2;
    }

    createGrid(productsList) {
        const grid = document.createElement('div');
        grid.className = 'grid-products';

        if(!productsList || productsList.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: var(--gray-text);">Nessun prodotto trovato in questa selezione.</p>`;
            return grid;
        }

        productsList.forEach(prod => {
            const isDisponibile = String(prod.disponibile) === 'true';
            const isNovita = String(prod.novita) === 'true';
            const photoUrl = this.getPhotoUrl(prod.foto);

            const card = document.createElement('div');
            card.className = `product-card ${!isDisponibile ? 'out-of-stock' : ''}`;
            
            card.innerHTML = `
                ${isNovita ? '<div class="badge-novita">Novità</div>' : ''}
                <div class="product-img-container">
                    <img src="${photoUrl}" alt="${prod.nome}" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%23999%22 text-anchor=%22middle%22 dy=%22.3em%22%3EFoto non disponibile%3C/text%3E%3C/svg%3E'">
                </div>
                <div class="product-info">
                    <div class="product-brand">${prod.brand}</div>
                    <div class="product-name">${prod.nome}</div>
                    <div class="product-desc">${prod.descrizione}</div>
                    <div class="product-meta">
                        <span><i class="fa-solid fa-boxes-stacked"></i> ${prod.packtype}</span>
                        <span>🏷️ ${prod.type}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="product-price">${parseFloat(prod.prezzo || 0).toFixed(2)}€</span>
                        <span style="font-size:12px; font-weight:bold; color:${isDisponibile ? 'var(--success-green)' : 'var(--danger-red)'}">
                            ${isDisponibile ? 'Disponibile' : 'Esaurito'}
                        </span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        return grid;
    }

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
                <td><img src="${photoUrl}" style="width:40px; height:40px; object-fit:contain; border-radius:4px;" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%40%22 height=%2240%22%3E%3Crect fill=%22%23f0f0f0%22 width=%2240%22 height=%2240%22/%3E%3C/svg%3E'"></td>
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
            alert('Inserisci un URL valido per la foto del prodotto.');
            return;
        }
        
        const inputPrezzo = document.getElementById('prod-prezzo').value;
        const parsedPrezzo = parseFloat(inputPrezzo);

        if (isNaN(parsedPrezzo)) {
            alert('Inserisci un prezzo numerico valido.');
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
        
        window.scrollTo({top: document.getElementById('admin-panel').offsetTop, behavior: 'smooth'});
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
        this.credentials = [{username: "admin", password: "password", telefono: "+393331234567"}];
        this.adminPhone = "+393331234567";
        this.products = [
            {id: "1", brand: "Frizz", nome: "Goleador Cola", descrizione: "Caramelle gommose frizzanti gusto Cola.", prezzo: 0.20, disponibile: true, novita: true, packtype: "monopezzo", type: "gommose", foto: ""},
            {id: "3", brand: "Chupa", nome: "Chupa Chups Fragola", descrizione: "Il lollipop più famoso al mondo.", prezzo: 0.50, disponibile: true, novita: true, packtype: "lollipop", type: "lollipop", foto: ""}
        ];
        this.buildFilterMenus();
        this.render();
    }
}

const app = new CatalogApp();
