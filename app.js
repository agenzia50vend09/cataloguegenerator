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
    generateAndSendPDF(sendWhatsApp = false) {
        if (!this.products || this.products.length === 0) {
            alert("Nessun prodotto disponibile per generare il catalogo.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Stile del PDF (Design coordinato Bianco e Blu)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(0, 45, 98); // --dark-blue
        doc.text("SWEETS CATALOGUE", 14, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(74, 85, 104); // --gray-text
        doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, 14, 26);
        
        let currentY = 32;
        const dataStruttura = this.getOrderedProductsStructure();

        // 1. Sezione Novità in Evidenza
        if (dataStruttura.novitaGenerali.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(0, 86, 179); // --primary-blue
            doc.text("✨ NOVITÀ IN EVIDENZA", 14, currentY);
            currentY += 5;

            const rowsNovita = dataStruttura.novitaGenerali.map(p => [
                p.nome, p.brand, `${parseFloat(p.prezzo || 0).toFixed(2)}€`, p.packtype, String(p.disponibile) === 'true' ? 'Sì' : 'No'
            ]);

            doc.autoTable({
                startY: currentY,
                head: [['Nome Prodotto', 'Brand', 'Prezzo', 'Confezione', 'Disponibile']],
                body: rowsNovita,
                headStyles: { fillColor: [0, 136, 204] }, // --accent-blue
                margin: { left: 14, right: 14 },
                theme: 'striped'
            });
            currentY = doc.lastAutoTable.finalY + 12;
        }

        // 2. Sezioni Divise Per Brand
        for (const brand in dataStruttura.strutturaBrand) {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(0, 45, 98);
            doc.text(`BRAND: ${brand.toUpperCase()}`, 14, currentY);
            currentY += 5;

            const rowsBrand = dataStruttura.strutturaBrand[brand].map(p => [
                String(p.novita) === 'true' ? `[NOVITÀ] ${p.nome}` : p.nome,
                `${parseFloat(p.prezzo || 0).toFixed(2)}€`,
                p.packtype,
                p.descrizione
            ]);

            doc.autoTable({
                startY: currentY,
                head: [['Nome Prodotto (Novità in testa)', 'Prezzo', 'Packaging', 'Descrizione']],
                body: rowsBrand,
                headStyles: { fillColor: [0, 45, 98] },
                margin: { left: 14, right: 14 },
                theme: 'striped'
            });
            currentY = doc.lastAutoTable.finalY + 12;
        }

        // Salvataggio locale del File PDF
        const filename = `Catalogo_Sweets_${Date.now()}.pdf`;
        doc.save(filename);

        // Se richiesto l'invio WhatsApp
        if (sendWhatsApp) {
            if (!this.currentUserPhone || this.currentUserPhone.trim() === "") {
                alert("Attenzione: nessun numero di cellulare associato a questo utente amministratore nel database credenziali.");
                return;
            }
            
            // Pulizia del numero di telefono da caratteri speciali
            const cleanPhone = this.currentUserPhone.replace(/[^0-9+]/g, '');
            const message = encodeURIComponent(`Ciao! Ho appena generato il nuovo *Catalogo Sweets* aggiornato. \nFile di riferimento: ${filename}\n\nUsa il pulsante allegati di WhatsApp per selezionare e inviarmi il file PDF appena scaricato.`);
            
            // Apertura di WhatsApp Web o App Mobile configurata sul numero dell'admin corrente
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
            window.open(whatsappUrl, '_blank');
        }
    }

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
