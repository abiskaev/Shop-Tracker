// — FILAMENT SUMMARY & <datalist> SETUP —
// Build the summary of all filaments and fill <datalist id="filamentOptions">
function updateSummary() {
  const raw = window._filaments || [];
  const map = {};
  raw.forEach(o => {
    const key = `${o.brand}||${o.type}`;
    if (!map[key]) map[key] = { brand:o.brand, type:o.type, totalQty:0, sumPrice:0, sumWeight:0 };
    map[key].totalQty  += o.qty;
    map[key].sumPrice  += o.price * o.qty;
    map[key].sumWeight += o.rollWeight * o.qty;
  });

  const summary = [];
  const dl = document.getElementById('filamentOptions');
  dl.innerHTML = '';
  const tbody = document.querySelector('#filamentSummaryTable tbody');
  tbody.innerHTML = '';

  Object.values(map).forEach(o => {
    // weighted avg price per kg
    const avgPerKg = (o.sumPrice/o.totalQty)/(o.sumWeight/o.totalQty)*1000;
    summary.push({ brand:o.brand, type:o.type, avgPricePerKg:avgPerKg });

    // fill summary table
    const row = tbody.insertRow();
    row.insertCell().textContent = o.brand;
    row.insertCell().textContent = o.type;
    row.insertCell().textContent = avgPerKg.toFixed(2);

    // fill <datalist>
    const opt = document.createElement('option');
    opt.value = `${o.brand} — ${o.type}`;
    dl.appendChild(opt);
  });

  window._filamentSummary = summary;
}
function populateFilamentOptions(){
  // if you ever need to re-populate after manual summary edits
  const summary = window._filamentSummary || [];
  const dl = document.getElementById('filamentOptions');
  dl.innerHTML = '';
  summary.forEach(s => {
    const opt = document.createElement('option');
    opt.value = `${s.brand} — ${s.type}`;
    dl.appendChild(opt);
  });
}

// — NAV TABS —  
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab)?.classList.add('active');
  });
});

// — PRINTS STOCK TABLE —  
document.addEventListener('DOMContentLoaded', () => {
  // make sure summary exists before any recalc
  updateSummary();
  populateFilamentOptions();

  const tableBody   = document.querySelector('#printsStockTable tbody');
  const addBtn      = document.getElementById('addPrintBtn');
  const deleteBtn   = document.getElementById('deletePrintBtn');

  function savePrintsStock() {
    const data = Array.from(tableBody.rows).map(r => ({
      name:           r.cells[1].querySelector('input').value,
      description:    r.cells[2].querySelector('input').value,
      qty:            parseFloat(r.cells[3].querySelector('input').value) || 0,
      weight:         parseFloat(r.cells[4].querySelector('input').value) || 0,
      filament:       r.querySelector('input.print-filament').value,
      avgPricePerKg:  parseFloat(r.dataset.avgPricePerKg) || 0,
      componentsCost: parseFloat(r.dataset.componentsCost) || 0,
      price:          parseFloat(r.cells[9].querySelector('input').value) || 0,
      checked:        r.cells[10].querySelector('input').checked
    }));
  
    fetch('/save/3d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prints: data,
        filaments: Array.from(document.querySelector('#filamentsTable tbody').rows).map(r => ({
          date:        r.querySelector('input.fil-date')?.value || '',
          orderNumber: r.querySelector('input.fil-order')?.value || '',
          brand:       r.querySelector('input.fil-brand')?.value || '',
          colour:      r.querySelector('input.fil-colour')?.value || '',
          type:        r.querySelector('input.fil-type')?.value || '',
          rollWeight:  +r.querySelector('input.fil-weight')?.value || 0,
          qty:         +r.querySelector('input.fil-qty')?.value || 0,
          price:       +r.querySelector('input.fil-price')?.value || 0
        }))
        
      })
      
    })
      .then(res => res.json())
      .then(resp => {
        if (resp.status === 'success') {
          console.log('✅ Prints saved to backend');
        } else {
          console.error('❌ Error saving prints:', resp.message);
          alert('Failed to save prints to backend.');
        }
      })
      .catch(e => {
        console.error('❌ Error saving prints:', e);
        alert('Failed to save prints to backend.');
      });
  }
  

  function recalcProductionCost(r) {
    // ensure we have a frozen avgPricePerKg
    let avg = parseFloat(r.dataset.avgPricePerKg);
    if (isNaN(avg) || avg === 0) {
      const [brand,type] = r.querySelector('input.print-filament').value.split(' — ');
      const summary = window._filamentSummary || [];
      const entry   = summary.find(s=>s.brand===brand&&s.type===type);
      avg = entry ? entry.avgPricePerKg : 0;
      r.dataset.avgPricePerKg = avg;
    }
    const w = parseFloat(r.cells[4].querySelector('input').value)||0;
    const q = parseFloat(r.cells[3].querySelector('input').value)||0;
    const prodCost = avg * (w/1000) * q;
    r.dataset.productionCost = prodCost;
    r.cells[6].textContent   = prodCost.toFixed(2);
    updateTotalCost(r);
  }

  function updateTotalCost(r) {
    const prod = parseFloat(r.dataset.productionCost)||0;
    const comp = parseFloat(r.dataset.componentsCost)||0;
    r.cells[8].textContent = (prod + comp).toFixed(2);
  }

  function createPrintRow(item={}) {
    const r = tableBody.insertRow();
    // #  
    r.insertCell().textContent = tableBody.rows.length;
    // Name, Desc
    ['name','description'].forEach((k,i)=>{
      const c = r.insertCell();
      const inp = document.createElement('input');
      inp.type  = 'text';
      inp.value = item[k]||'';
      inp.addEventListener('input', () => { recalcProductionCost(r); savePrintsStock(); });
      c.appendChild(inp);
    });
    // Qty, Weight
    ['qty','weight'].forEach((k,i)=>{
      const c = r.insertCell();
      const inp = document.createElement('input');
      inp.type  = 'number'; inp.min='0';
      inp.value = item[k]||'';
      inp.addEventListener('input', () => { recalcProductionCost(r); savePrintsStock(); });
      c.appendChild(inp);
    });
    // Filament
    const fc = r.insertCell();
    const fin = document.createElement('input');
    fin.type         = 'text';
    fin.setAttribute('list','filamentOptions');
    fin.className    = 'print-filament';
    fin.value        = item.filament||'';
    if (item.avgPricePerKg!=null) r.dataset.avgPricePerKg = item.avgPricePerKg;
    fin.addEventListener('input', () => { recalcProductionCost(r); savePrintsStock(); });
    fc.appendChild(fin);
    // ProductionCost cell
    r.insertCell();
    // ComponentsCost input
    const cc = r.insertCell();
    const cinp = document.createElement('input');
    cinp.type = 'number'; cinp.min='0';
    cinp.value = item.componentsCost||'';
    r.dataset.componentsCost = item.componentsCost||0;
    cinp.addEventListener('input', () => {
      r.dataset.componentsCost = parseFloat(cinp.value)||0;
      updateTotalCost(r);
      savePrintsStock();
    });
    cc.appendChild(cinp);
    // TotalCost
    r.insertCell();
    // Price
    const pc = r.insertCell();
    const pin = document.createElement('input');
    pin.type  = 'number'; pin.min='0';
    pin.value = item.price||'';
    pin.addEventListener('input', savePrintsStock);
    pc.appendChild(pin);
    // Checkbox
    const cb = r.insertCell();
    const chk= document.createElement('input');
    chk.type      = 'checkbox';
    chk.className = 'print-select';
    chk.checked   = !!item.checked;
    chk.addEventListener('change', () => {
      updateDeleteState();
      savePrintsStock();
    });
    cb.appendChild(chk);

    // initial calcs
    recalcProductionCost(r);
    updateTotalCost(r);
  }

  function loadPrintsStock() {
    fetch('/data/3d')
      .then(res => res.json())
      .then(data => {
        const items = Array.isArray(data.prints) ? data.prints : [];
        window._prints = items;
        items.forEach(createPrintRow);
        updateDeleteState();
        console.log(`✅ Loaded ${items.length} prints from backend`);
      })
      .catch(err => {
        console.error('❌ Failed to load prints:', err);
        alert('Failed to load prints data.');
      });
  }
  

  function renumber() {
    Array.from(tableBody.rows).forEach((r,i)=> r.cells[0].textContent = i+1);
  }
  function updateDeleteState() {
    deleteBtn.disabled = !tableBody.querySelector('input.print-select:checked');
  }

  // INITIAL
  loadPrintsStock();

  // ADD ROW
  addBtn.addEventListener('click', ()=>{
    createPrintRow();
    renumber();
    savePrintsStock();
    updateDeleteState();
  });

  // DELETE
  deleteBtn.addEventListener('click', ()=>{
    Array.from(tableBody.querySelectorAll('input.print-select:checked'))
      .forEach(c=>c.closest('tr').remove());
    renumber();
    savePrintsStock();
    updateDeleteState();
  });
});

// — FILAMENTS TABLE FUNCTIONALITY —  
document.addEventListener('DOMContentLoaded',()=>{
  const tbody    = document.querySelector('#filamentsTable tbody');
  const addBtn   = document.getElementById('addFilamentBtn');
  const delBtn   = document.getElementById('deleteFilamentBtn');
  const KEY      = 'filamentsData';

  function saveAll() {
    const data = Array.from(tbody.rows).map(r => ({
      date:        r.querySelector('input.fil-date').value,
      orderNumber: r.querySelector('input.fil-order').value,
      brand:       r.querySelector('input.fil-brand').value,
      colour:      r.querySelector('input.fil-colour').value,
      type:        r.querySelector('input.fil-type').value,
      rollWeight:  +r.querySelector('input.fil-weight').value || 0,
      qty:         +r.querySelector('input.fil-qty').value || 0,
      price:       +r.querySelector('input.fil-price').value || 0
    }));
  
    fetch('/filaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
      if (result.status === 'success') {
        console.log(`✅ Saved ${data.length} filament entries to backend`);
        window._filaments = data;  // update in-memory source
        updateSummary();           // regenerate summary
        populateFilamentOptions(); // refresh <datalist> too
      } else {
        throw new Error(result.message || 'Unknown backend error');
      }
    })
    .catch(err => {
      console.error('❌ Failed to save filament data to backend:', err);
      alert('Error saving filament data to backend.');
    });
  }
  

  function loadAll() {
    fetch('/filaments')
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Expected an array from backend');
        
        window._filaments = data;        // <-- REQUIRED for updateSummary()
        updateSummary();                 // <-- Populates the summary table
        populateFilamentOptions();       // <-- Optional if needed elsewhere
  
        data.forEach(it => addRow(it));
        updateDelete();
  
        console.log(`✅ Loaded ${data.length} filaments from backend`);
      })
      .catch(err => {
        console.error('❌ Failed to load filaments from backend:', err);
        alert('Error loading filament data from backend.');
      });
  }
  
  

  function renumber(){
    Array.from(tbody.rows).forEach((r,i)=> r.cells[0].textContent=i+1);
  }
  function updateDelete(){
    delBtn.disabled = !tbody.querySelector('input.fil-select:checked');
  }
  function recalc(r){
    const q=+r.querySelector('input.fil-qty').value||0;
    const p=+r.querySelector('input.fil-price').value||0;
    r.querySelector('td.fil-total').textContent = (q*p).toFixed(2);
  }

  function addRow(item={}){
    const r=tbody.insertRow();
    r.insertCell().textContent=tbody.rows.length;
    const mk=(cls,val,ev)=>{
      const c=r.insertCell(),i=document.createElement('input');
      i.type = cls==='fil-date'?'date':'text';
      i.className=cls; if(val!=null) i.value=val;
      i.addEventListener('input', ev||saveAll);
      c.appendChild(i);
    };
    mk('fil-date',item.date);
    mk('fil-order',item.orderNumber);
    mk('fil-brand',item.brand);
    mk('fil-colour',item.colour);
    mk('fil-type',item.type);

    // rollWeight
    let c=r.insertCell(),i=document.createElement('input');
    i.type='number';i.min='0';i.className='fil-weight';
    i.value=item.rollWeight!=null?item.rollWeight:1000;
    i.addEventListener('input', saveAll);
    c.appendChild(i);

    // qty
    c=r.insertCell();i=document.createElement('input');
    i.type='number';i.min='0';i.className='fil-qty';
    i.value=item.qty||'';
    i.addEventListener('input',()=>{recalc(r);saveAll();});
    c.appendChild(i);

    // price per roll
    c=r.insertCell();i=document.createElement('input');
    i.type='number';i.min='0';i.className='fil-price';
    i.value=item.price||'';
    i.addEventListener('input',()=>{recalc(r);saveAll();});
    c.appendChild(i);

    // total
    r.insertCell().className='fil-total';

    // checkbox
    c=r.insertCell();i=document.createElement('input');
    i.type='checkbox';i.className='fil-select';
    i.addEventListener('change', updateDelete);
    c.appendChild(i);

    renumber(); recalc(r); updateDelete();
  }

  loadAll();
  addBtn.addEventListener('click', ()=>{addRow({}); saveAll();});
  delBtn.addEventListener('click', ()=>{
    Array.from(tbody.querySelectorAll('input.fil-select:checked'))
      .forEach(chk=>chk.closest('tr').remove());
    renumber(); saveAll(); updateDelete();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  if (!tabButtons.length) {
    console.warn("⚠️ No .nav-tab elements found. Is the HTML loaded yet?");
    return;
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();

      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(btn.dataset.tab)?.classList.add('active');
    });
  });

  // Automatically activate first tab
  tabButtons[0].click();
});
