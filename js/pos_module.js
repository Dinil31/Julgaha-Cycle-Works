// ==========================================
// 4. NEW HR SYSTEM (ATTENDANCE, PENALTIES & PAYROLL)
// ==========================================
let workersData = [];

export async function loadHR() {
    const sb = getSupabase();
    const { data } = await sb.from('workers').select('*').order('id', { ascending: false });
    workersData = data || [];
    
    const list = document.getElementById('workers-list');
    list.innerHTML = '';
    
    const attSelect = document.getElementById('hr-att-worker');
    const advSelect = document.getElementById('hr-adv-worker');
    const paySelect = document.getElementById('hr-pay-worker');
    let options = '<option value="">Select Worker...</option>';

    workersData.forEach(w => {
        // Render Advanced Worker Card (Shows custom ID and PIN for Admin)
        list.innerHTML += `
            <div class="p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 transition hover:scale-[1.02]">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-black text-gray-800 dark:text-white text-lg">
                            ${w.name} 
                        </h4>
                        <div class="flex gap-2 mt-1 mb-1">
                            <span class="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-mono font-bold border border-indigo-200">ID: ${w.worker_uid || w.id}</span>
                            <span class="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-mono font-bold border border-yellow-200">PIN: ${w.pin || '1234'}</span>
                        </div>
                        <p class="text-xs text-gray-500"><i class="fas fa-phone mr-1"></i> ${w.phone || 'N/A'}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.posModule.viewWorkerAttendance('${w.id}')" class="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-lg" title="Live Salary Tracker"><i class="fas fa-chart-bar"></i></button>
                        <button onclick="window.posModule.openEditWorker('${w.id}')" class="text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 p-2 rounded-lg" title="Edit PIN & Details"><i class="fas fa-edit"></i></button>
                        <button onclick="window.posModule.deleteWorker('${w.id}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-300 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> ${w.address || 'N/A'}</div>
                <div class="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold px-3 py-1 rounded inline-block text-xs uppercase tracking-wider">
                    ${formatCurrency(w.daily_salary)} / Day
                </div>
            </div>`;
            
        options += `<option value="${w.id}">${w.name} (${w.worker_uid || w.id})</option>`;
    });

    if(attSelect) attSelect.innerHTML = options;
    if(advSelect) advSelect.innerHTML = options;
    if(paySelect) paySelect.innerHTML = options;
    
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('hr-att-date')) document.getElementById('hr-att-date').value = today;
    if(document.getElementById('hr-adv-date')) document.getElementById('hr-adv-date').value = today;
}

export async function addWorker(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    
    // 1. Generate Custom ID (e.g., W2026001)
    const year = new Date().getFullYear();
    const { data: lastWorker } = await sb.from('workers')
        .select('worker_uid')
        .ilike('worker_uid', `W${year}%`)
        .order('worker_uid', { ascending: false })
        .limit(1);

    let nextNum = 1;
    if (lastWorker && lastWorker.length > 0 && lastWorker[0].worker_uid) {
        const lastNumStr = lastWorker[0].worker_uid.slice(-3);
        nextNum = parseInt(lastNumStr) + 1;
    }
    const generatedUid = `W${year}${String(nextNum).padStart(3, '0')}`;

    // 2. Insert into DB
    const { error } = await sb.from('workers').insert({ 
        worker_uid: generatedUid,
        name: form.get('name'), 
        phone: form.get('phone'), 
        address: form.get('address'),
        daily_salary: Number(form.get('daily_salary')), 
        pin: '1234' // Default PIN
    });

    if(error) alert(error.message); 
    else { 
        await showCustomConfirm("Success", `Worker Created! \nLogin ID: ${generatedUid}\nDefault PIN: 1234`, "success-green"); 
        e.target.reset(); 
        loadHR(); 
    }
}

export function openEditWorker(id) {
    const w = workersData.find(x => String(x.id) === String(id));
    if(!w) return;
    
    document.getElementById('ew-id').value = w.id;
    document.getElementById('ew-name').value = w.name;
    document.getElementById('ew-phone').value = w.phone || '';
    document.getElementById('ew-address').value = w.address || '';
    document.getElementById('ew-salary').value = w.daily_salary;
    document.getElementById('ew-pin').value = w.pin || '1234';
    
    document.getElementById('edit-worker-modal').classList.remove('hidden');
}

export async function saveEditWorker(e) {
    e.preventDefault();
    const sb = getSupabase();
    const id = document.getElementById('ew-id').value;
    
    const updates = {
        name: document.getElementById('ew-name').value, 
        phone: document.getElementById('ew-phone').value, 
        address: document.getElementById('ew-address').value,
        daily_salary: Number(document.getElementById('ew-salary').value), 
        pin: document.getElementById('ew-pin').value
    };

    const { error } = await sb.from('workers').update(updates).eq('id', id);
    if(error) alert("Error saving worker: " + error.message);
    else { 
        document.getElementById('edit-worker-modal').classList.add('hidden'); 
        await showCustomConfirm("Updated", "Worker details successfully saved.", "success-green");
        loadHR(); 
    }
}

export async function deleteWorker(id) {
    if(await showCustomConfirm("Delete Worker?", "This deletes the worker, attendance, and advances.", "danger")) {
        await getSupabase().from('workers').delete().eq('id', id); 
        loadHR();
    }
}

export async function markAttendance(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const wId = form.get('worker_id');
    const dateVal = form.get('date');
    if(!wId) return alert("Select a worker.");

    await sb.from('attendance').delete().match({ worker_id: wId, date: dateVal });

    const { error } = await sb.from('attendance').insert({
        worker_id: wId, date: dateVal, status: form.get('status'),
        in_time: form.get('in_time') || null, out_time: form.get('out_time') || null
    });

    if(error) alert("Error: " + error.message);
    else { await showCustomConfirm("Saved", `Attendance marked for ${dateVal}`, "success-green"); e.target.reset(); document.getElementById('hr-att-date').value = new Date().toISOString().split('T')[0]; }
}

export async function addAdvance(e) {
    e.preventDefault();
    const sb = getSupabase();
    const form = new FormData(e.target);
    const wId = form.get('worker_id');
    if(!wId) return alert("Select a worker.");
    const { error } = await sb.from('advances').insert({ worker_id: wId, date: form.get('date'), amount: Number(form.get('amount')) });
    if(error) alert("Error: " + error.message); else { await showCustomConfirm("Advance Saved", "Money deducted from salary.", "success-green"); e.target.reset(); document.getElementById('hr-adv-date').value = new Date().toISOString().split('T')[0]; }
}

// --- SALARY CALCULATION ENGINE ---
export async function calculateWorkerSalary(wId, monthStr) {
    const sb = getSupabase();
    const worker = workersData.find(w => String(w.id) === String(wId));
    if(!worker) return null;

    const [year, month] = monthStr.split('-');
    const startDate = `${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: attData } = await sb.from('attendance').select('*').eq('worker_id', wId).gte('date', startDate).lte('date', endDate).order('date', {ascending:true});
    const { data: advData } = await sb.from('advances').select('*').eq('worker_id', wId).gte('date', startDate).lte('date', endDate);

    let full = 0, half = 0, short = 0, timePenalty = 0;

    (attData || []).forEach(a => {
        if(a.status === 'Half Day') half++;
        else if(a.status === 'Short Leave') short++;
        else if(a.status === 'Full Day') {
            full++;
            if(a.in_time && a.out_time) {
                const parse = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
                const inMins = parse(a.in_time);
                const outMins = parse(a.out_time);
                let missed = 0;
                
                if(inMins > 600) missed += (inMins - 600); // Late after 10:00
                if(outMins < 1020) missed += (1020 - outMins); // Early before 17:00
                
                if(missed > 0) {
                    const ratePerMin = worker.daily_salary / 420; 
                    timePenalty += (missed * ratePerMin);
                }
            }
        }
    });

    const baseGross = (full * worker.daily_salary) + (short * worker.daily_salary) + (half * (worker.daily_salary / 2));
    const grossEarnings = baseGross - timePenalty;
    const totalAdvances = (advData || []).reduce((sum, a) => sum + Number(a.amount), 0);
    const epfDeduction = grossEarnings > 0 ? grossEarnings * 0.08 : 0;
    const netPay = grossEarnings - totalAdvances - epfDeduction;

    return { worker, attData, advData, full, half, short, timePenalty, grossEarnings, totalAdvances, epfDeduction, netPay, monthStr };
}

// --- ADMIN VIEW ATTENDANCE MODAL ---
export async function viewWorkerAttendance(id) {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
    document.getElementById('view-att-month').value = monthStr;
    document.getElementById('view-att-wid').value = id;
    await renderWorkerAttendanceUI(id, monthStr);
    document.getElementById('view-attendance-modal').classList.remove('hidden');
}

export async function updateAdminAttendanceView() {
    const id = document.getElementById('view-att-wid').value;
    const monthStr = document.getElementById('view-att-month').value;
    await renderWorkerAttendanceUI(id, monthStr);
}

async function renderWorkerAttendanceUI(id, monthStr) {
    const data = await calculateWorkerSalary(id, monthStr);
    if(!data) return;

    document.getElementById('view-att-name').innerText = data.worker.name + ` (${data.worker.worker_uid})`;
    document.getElementById('view-att-gross').innerText = formatCurrency(data.grossEarnings);
    document.getElementById('view-att-net').innerText = formatCurrency(data.netPay);
    
    const tbody = document.getElementById('view-att-table');
    tbody.innerHTML = '';
    
    data.attData.forEach(a => {
        let penText = '-';
        if(a.status === 'Full Day' && a.in_time && a.out_time) {
            const inMins = parseInt(a.in_time.split(':')[0])*60 + parseInt(a.in_time.split(':')[1]);
            const outMins = parseInt(a.out_time.split(':')[0])*60 + parseInt(a.out_time.split(':')[1]);
            let missed = 0;
            if(inMins > 600) missed += (inMins - 600);
            if(outMins < 1020) missed += (1020 - outMins);
            if(missed > 0) penText = formatCurrency(missed * (data.worker.daily_salary / 420));
        }
        tbody.innerHTML += `<tr class="border-b dark:border-gray-700 text-sm"><td class="p-2">${a.date}</td><td class="p-2 font-bold">${a.status}</td><td class="p-2">${a.in_time || '-'} to ${a.out_time || '-'}</td><td class="p-2 text-red-500">${penText}</td></tr>`;
    });
    if(data.attData.length === 0) tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">No records found.</td></tr>`;
}

export async function generatePayroll(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const data = await calculateWorkerSalary(form.get('worker_id'), form.get('month'));
    if(!data) return alert("Worker not found.");

    const epfEmployer = data.grossEarnings * 0.12;
    const etfEmployer = data.grossEarnings * 0.03;

    const w = window.open('', '', 'width=600,height=800');
    const html = `<html><head><style>
        body{font-family: Arial, sans-serif; padding: 40px; color: #333;}
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;}
        h1 { margin: 0; color: #1e3a8a; } h3 { margin: 5px 0; color: #666; }
        .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #eee; padding: 10px 0; font-size:14px;}
        .bold { font-weight: bold; }
        .total-row { display: flex; justify-content: space-between; border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 15px 0; font-size: 18px; margin-top: 20px; background: #f8fafc;}
        .section-title { margin-top: 30px; font-size: 14px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ccc; padding-bottom: 5px;}
        .adv-list { font-size: 12px; color: #888; padding-left: 20px; margin: 2px 0;}
    </style></head><body>
        <div class="header"><h1>CycleSense</h1><h3>Salary Slip</h3><p>Month: <b>${data.monthStr}</b></p></div>
        <div class="row"><span>Employee:</span> <span class="bold">${data.worker.name} (ID: ${data.worker.worker_uid})</span></div>
        <div class="row"><span>Daily Rate:</span> <span>${formatCurrency(data.worker.daily_salary)}</span></div>

        <div class="section-title">Earnings & Deductions</div>
        <div class="row"><span>Full Days (${data.full})</span> <span>${formatCurrency(data.full * data.worker.daily_salary)}</span></div>
        <div class="row"><span>Half Days (${data.half})</span> <span>${formatCurrency(data.half * (data.worker.daily_salary / 2))}</span></div>
        <div class="row"><span>Short Leaves (${data.short})</span> <span>${formatCurrency(data.short * data.worker.daily_salary)}</span></div>
        <div class="row text-red"><span>Time Penalties (Late/Early)</span> <span style="color:red">- ${formatCurrency(data.timePenalty)}</span></div>
        <div class="row" style="background:#f4f4f4;"><span><b>Gross Earnings</b></span> <span class="bold">${formatCurrency(data.grossEarnings)}</span></div>

        <div class="section-title">Subtractions</div>
        <div class="row"><span>Advances Taken</span> <span style="color:red">- ${formatCurrency(data.totalAdvances)}</span></div>
        ${data.advData.map(a => `<div class="adv-list">${a.date} : ${formatCurrency(a.amount)}</div>`).join('')}
        <div class="row"><span>EPF Deduction (8%)</span> <span style="color:red">- ${formatCurrency(data.epfDeduction)}</span></div>

        <div class="total-row"><span class="bold" style="color: #16a34a;">NET PAYABLE</span> <span class="bold" style="color: #16a34a;">${formatCurrency(data.netPay)}</span></div>

        <div class="section-title">Employer Contributions (Info Only)</div>
        <div class="row"><span>EPF (12%)</span> <span>${formatCurrency(epfEmployer)}</span></div>
        <div class="row"><span>ETF (3%)</span> <span>${formatCurrency(etfEmployer)}</span></div>

        <div style="margin-top: 50px; display: flex; justify-content: space-between;">
            <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Manager</div>
            <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px;">Employee</div>
        </div>
        <script>window.print();</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
}
