// 2026년 한국 공휴일 데이터
const HOLIDAYS_2026 = [
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-03-01", "2026-03-02",
    "2026-05-05", "2026-05-24", "2026-05-25", "2026-06-06", "2026-08-15", "2026-08-17",
    "2026-09-24", "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-05", "2026-10-09", "2026-12-25"
];

let state = {
    startDate: '',
    endDate: '',
    entries: [],
};

let deleteTargetId = null;

// --- Data Management Functions ---

function exportData() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flex-work-data-${getLocalDateString(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (confirm('기존 데이터를 덮어쓰고 새로 가져오시겠습니까?')) {
                state = { ...state, ...imported };
                saveToLocalStorage();
                renderAll();
                alert('데이터를 성공적으로 가져왔습니다!');
            }
        } catch (err) {
            alert('유효하지 않은 파일 형식입니다.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset for next use
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    initEventListeners();
    initTabs();
    renderAll();
});

function initEventListeners() {
    document.getElementById('setPeriodBtn').addEventListener('click', () => {
        const s = document.getElementById('startDate').value;
        const e = document.getElementById('endDate').value;
        if (!s || !e) return alert('날짜를 입력하세요.');
        state.startDate = s;
        state.endDate = e;
        saveToLocalStorage();
        renderAll();
    });

    const modal = document.getElementById('entryModal');
    document.getElementById('addEntryBtn').addEventListener('click', () => {
        document.getElementById('entryForm').reset();
        document.getElementById('editEntryId').value = '';
        document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('modalTitle').innerText = '근무 기록 추가';
        toggleTimeInputs('work');
        modal.style.display = 'flex';
    });

    document.getElementById('entryType').addEventListener('change', (e) => toggleTimeInputs(e.target.value));
    document.getElementById('cancelBtn').addEventListener('click', () => modal.style.display = 'none');

    // Delete Confirmation Event Listeners
    document.getElementById('confirmCancelBtn').addEventListener('click', () => {
        document.getElementById('confirmModal').style.display = 'none';
        deleteTargetId = null;
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        if (deleteTargetId !== null) {
            state.entries = state.entries.filter(e => e.id !== deleteTargetId);
            saveToLocalStorage();
            renderAll();
            document.getElementById('confirmModal').style.display = 'none';
            deleteTargetId = null;
        }
    });

    // Data Management
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importData);

    document.getElementById('entryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editEntryId').value;
        const date = document.getElementById('entryDate').value;
        const type = document.getElementById('entryType').value;
        let seconds = 0;
        let startTime = "";
        let endTime = "";

        if (type === 'work' || type === 'holiday') {
            startTime = document.getElementById('startTime').value;
            endTime = document.getElementById('endTime').value;
            if (startTime && endTime) {
                seconds = calculateWorkDuration(startTime, endTime);
            } else {
                seconds = parseHHMMSSToSeconds(document.getElementById('entryTime').value);
            }
        } else if (type === 'annual') {
            seconds = 8 * 3600;
        } else {
            seconds = 4 * 3600;
        }

        const entryData = { 
            id: id ? parseInt(id) : Date.now(), 
            date, 
            type, 
            seconds,
            startTime,
            endTime 
        };

        if (id) {
            const idx = state.entries.findIndex(e => e.id === parseInt(id));
            state.entries[idx] = entryData;
        } else {
            state.entries.push(entryData);
        }

        state.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveToLocalStorage();
        modal.style.display = 'none';
        renderAll();
    });
}

function initTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            btns.forEach(b => b.classList.toggle('active', b === btn));
            contents.forEach(c => c.classList.toggle('active', c.id === `${tab}Tab`));
            if (tab === 'calendar') renderCalendar();
        });
    });
}

function toggleTimeInputs(type) {
    const row = document.querySelector('.input-group-row');
    const manual = document.getElementById('manualTimeGroup');
    if (type === 'annual' || type.startsWith('half')) {
        row.style.display = 'none';
        manual.style.display = 'none';
    } else {
        row.style.display = 'flex';
        manual.style.display = 'block';
    }
}

function calculateWorkDuration(start, end) {
    const s = parseHHMMSSToSeconds(start + (start.split(':').length === 2 ? ':00' : ''));
    const e = parseHHMMSSToSeconds(end + (end.split(':').length === 2 ? ':00' : ''));
    let diff = e - s;
    if (diff < 0) diff += 24 * 3600;

    // 점심시간 (12:00 ~ 13:00) 오버랩 계산
    const lunchStart = 12 * 3600;
    const lunchEnd = 13 * 3600;
    
    // 출근시간과 퇴근시간이 점심시간과 겹치는 구간 계산
    const overlapStart = Math.max(s, lunchStart);
    const overlapEnd = Math.min(e, lunchEnd);
    const lunchOverlap = Math.max(0, overlapEnd - overlapStart);
    
    // 법정 최소 휴게시간 (4시간당 30분) 보전
    // 점심시간 공제가 법정 최소치보다 작을 경우 최소치를 적용함
    let deduction = lunchOverlap;
    if (diff > 8 * 3600 && deduction < 3600) deduction = 3600;
    else if (diff > 4 * 3600 && deduction < 1800) deduction = 1800;
    
    return Math.max(0, diff - deduction);
}

function parseHHMMSSToSeconds(str) {
    if (!str) return 0;
    const p = str.split(':').map(Number);
    return (p[0] * 3600) + (p[1] * 60) + (p[2] || 0);
}

function formatSecondsToHHMMSS(s) {
    const neg = s < 0;
    const a = Math.abs(s);
    const h = Math.floor(a / 3600);
    const m = Math.floor((a % 3600) / 60);
    const sc = Math.floor(a % 60);
    const f = (n) => n.toString().padStart(2, '0');
    return `${neg ? '-' : ''}${f(h)}:${f(m)}:${f(sc)}`;
}

function getLocalDateString(d) {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function getWorkingDays(start, end) {
    let count = 0;
    // 날짜 객체 복사본 사용 및 루프 안정화
    const current = new Date(start);
    current.setHours(0,0,0,0);
    const targetEnd = new Date(end);
    targetEnd.setHours(0,0,0,0);

    while (current <= targetEnd) {
        const ds = getLocalDateString(current);
        const day = current.getDay();
        // 주말(0:일, 6:토) 및 공휴일 제외
        if (day !== 0 && day !== 6 && !HOLIDAYS_2026.includes(ds)) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

function renderAll() {
    renderDashboard();
    renderAnnualLeave();
}

function renderDashboard() {
    if (!state.startDate || !state.endDate) return;
    const stats = calculateStats();
    
    document.getElementById('totalWorkHours').innerText = formatSecondsToHHMMSS(stats.workedSeconds);
    document.getElementById('targetWorkHours').innerText = formatSecondsToHHMMSS(stats.targetSeconds);
    document.getElementById('remainingWorkHours').innerText = formatSecondsToHHMMSS(stats.diffFromElapsed);
    document.getElementById('totalHolidayHours').innerText = formatSecondsToHHMMSS(stats.holidaySeconds);
    document.getElementById('daysInPeriod').innerText = `실근무 ${stats.totalWorkingDays}일 기준`;
    document.getElementById('workProgress').style.width = `${stats.progress}%`;

    const statusCard = document.getElementById('remainingWorkCard');
    const statusText = document.getElementById('workStatusText');
    statusCard.classList.remove('danger', 'success', 'info');
    
    if (stats.diffFromElapsed < 0) {
        statusCard.classList.add('danger');
        statusText.innerText = `현재 시점 대비 ${formatSecondsToHHMMSS(Math.abs(stats.diffFromElapsed))} 부족`;
    } else {
        statusCard.classList.add(stats.diffFromElapsed < 3600 ? 'success' : 'info');
        const prefix = stats.diffFromElapsed < 3600 ? '정상 궤도' : '초과 근무';
        statusText.innerText = `${prefix} (${formatSecondsToHHMMSS(stats.diffFromElapsed)} 여유)`;
    }

    const list = document.getElementById('entryList');
    list.innerHTML = '';
    state.entries.forEach(e => {
        const tr = document.createElement('tr');
        const detail = e.startTime ? `${e.startTime} ~ ${e.endTime}` : '-';
        tr.innerHTML = `
            <td>${e.date}</td>
            <td>${getLabel(e.type)}</td>
            <td>${formatSecondsToHHMMSS(e.seconds)}</td>
            <td>${detail}</td>
            <td>
                <button onclick="editEntry(${e.id})" class="text-btn" style="color:#00d2ff">수정</button>
                <button onclick="deleteEntry(${e.id})" class="text-btn" style="color:#ff4d4d">삭제</button>
            </td>
        `;
        list.appendChild(tr);
    });
}

function calculateStats() {
    const start = new Date(state.startDate);
    const end = new Date(state.endDate);
    const totalWorkingDays = getWorkingDays(new Date(start), new Date(end));
    const targetSeconds = totalWorkingDays * 8 * 3600;

    const today = new Date(); today.setHours(0,0,0,0);
    const effectiveToday = today > end ? end : (today < start ? start : today);
    const elapsedWorkingDays = getWorkingDays(new Date(start), effectiveToday);
    const elapsedTargetSeconds = elapsedWorkingDays * 8 * 3600;

    let workedSeconds = 0;
    let holidaySeconds = 0;
    state.entries.forEach(e => {
        if (['work', 'annual', 'halfMorning', 'halfAfternoon'].includes(e.type)) workedSeconds += e.seconds;
        else holidaySeconds += e.seconds;
    });

    return { 
        totalWorkingDays, targetSeconds, workedSeconds, holidaySeconds, 
        diffFromElapsed: workedSeconds - elapsedTargetSeconds,
        progress: Math.min(100, (workedSeconds / targetSeconds) * 100) 
    };
}

function renderAnnualLeave() {
    const list = document.getElementById('annualLeaveList');
    list.innerHTML = '';
    let total = 0;
    state.entries.filter(e => e.type === 'annual' || e.type.startsWith('half')).forEach(e => {
        const count = e.type === 'annual' ? 1 : 0.5;
        total += count;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${e.date}</td><td>${getLabel(e.type)}</td><td>${count}개</td>`;
        list.appendChild(tr);
    });
    document.getElementById('totalAnnualCount').innerText = `${total.toFixed(1)}개`;
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    
    for (let m = 0; m < 12; m++) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'month-view glass';
        monthDiv.innerHTML = `<div class="month-name">${months[m]}</div>`;
        
        const daysGrid = document.createElement('div');
        daysGrid.className = 'days-grid';
        ["일", "월", "화", "수", "목", "금", "토"].forEach(d => {
            daysGrid.innerHTML += `<div class="day-header">${d}</div>`;
        });

        const firstDay = new Date(2026, m, 1).getDay();
        const lastDate = new Date(2026, m + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) daysGrid.innerHTML += `<div></div>`;
        
        for (let d = 1; d <= lastDate; d++) {
            const dateStr = `2026-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            const isHoliday = HOLIDAYS_2026.includes(dateStr) || new Date(2026, m, d).getDay() === 0;
            const entries = state.entries.filter(e => e.date === dateStr);
            const hasWork = entries.some(e => e.type === 'work');
            const hasLeave = entries.some(e => e.type === 'annual' || e.type.startsWith('half'));
            
            const classes = ['day-cell'];
            if (isHoliday) classes.push('holiday');
            if (hasWork) classes.push('has-work');
            if (hasLeave) classes.push('has-leave');
            
            daysGrid.innerHTML += `<div class="${classes.join(' ')}">${d}</div>`;
        }
        monthDiv.appendChild(daysGrid);
        grid.appendChild(monthDiv);
    }
}

function editEntry(id) {
    const entry = state.entries.find(e => e.id === id);
    if (!entry) return;
    
    const modal = document.getElementById('entryModal');
    document.getElementById('editEntryId').value = entry.id;
    document.getElementById('entryDate').value = entry.date;
    document.getElementById('entryType').value = entry.type;
    document.getElementById('modalTitle').innerText = '근무 기록 수정';
    
    toggleTimeInputs(entry.type);
    if (entry.startTime) {
        document.getElementById('startTime').value = entry.startTime;
        document.getElementById('endTime').value = entry.endTime;
    } else {
        document.getElementById('entryTime').value = formatSecondsToHHMMSS(entry.seconds);
    }
    
    modal.style.display = 'flex';
}

function getLabel(t) {
    return {work:'정상 근무', holiday:'휴일 근무', annual:'연차', halfMorning:'오전 반차', halfAfternoon:'오후 반차'}[t] || t;
}

function deleteEntry(id) {
    deleteTargetId = id;
    document.getElementById('confirmModal').style.display = 'flex';
}

function saveToLocalStorage() { localStorage.setItem('flexWorkState', JSON.stringify(state)); }
function loadFromLocalStorage() { const s = localStorage.getItem('flexWorkState'); if(s) state = JSON.parse(s); }
