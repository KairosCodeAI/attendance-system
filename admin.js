// Google Apps Script 웹앱 배포 URL (GET 요청 처리)
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby2nwFxRp_1WNqT30Bjmhx7c2lgqFSdfeyM9iABt3xTroDR3NPsmBr8jw391SMf8niz/exec";

let currentType = 'attendance';

document.addEventListener('DOMContentLoaded', () => {
    fetchData('attendance');

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => fetchData(currentType));
    }

    document.getElementById('tab-attendance').addEventListener('click', (e) => switchTab(e, 'attendance'));
    document.getElementById('tab-register').addEventListener('click', (e) => switchTab(e, 'register'));
    document.getElementById('tab-settings').addEventListener('click', (e) => switchTab(e, 'settings'));

    const updateCodeBtn = document.getElementById('updateCodeBtn');
    if (updateCodeBtn) {
        updateCodeBtn.addEventListener('click', updateAttendanceCode);
    }
});

function switchTab(e, type) {
    e.preventDefault();
    currentType = type;
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    const headerTitle = document.querySelector('.header-title');
    const tableCard = document.querySelector('.table-card');
    const statsGrid = document.querySelector('.stats-grid');
    const settingsContainer = document.getElementById('settings-container');

    if (type === 'settings') {
        headerTitle.textContent = '시스템 설정';
        tableCard.style.display = 'none';
        statsGrid.style.display = 'none';
        settingsContainer.style.display = 'block';
    } else if (type === 'register') {
        headerTitle.textContent = '학생 관리 (수강신청 현황)';
        tableCard.style.display = 'block';
        document.querySelector('.table-header h3').textContent = '수강신청 목록';
        statsGrid.style.display = 'none';
        settingsContainer.style.display = 'none';
    } else {
        headerTitle.textContent = '출석 현황 대시보드';
        tableCard.style.display = 'block';
        document.querySelector('.table-header h3').textContent = '최근 출석 기록';
        statsGrid.style.display = 'grid';
        settingsContainer.style.display = 'none';
    }
    
    fetchData(type);
}

async function fetchData(type) {
    const loadingSpinner = document.getElementById('loading-spinner');
    const tableContainer = document.getElementById('table-container');
    const tableBody = document.getElementById('table-body');

    // Show loading
    loadingSpinner.style.display = 'flex';
    tableContainer.style.display = 'none';

    try {
        if (GAS_WEB_APP_URL === "여기에_웹앱_URL을_붙여넣으세요" || !GAS_WEB_APP_URL) {
            throw new Error("웹앱 URL이 설정되지 않았습니다. 코드를 수정해주세요.");
        }

        // Add type parameter and dummy parameter to prevent caching
        const response = await fetch(`${GAS_WEB_APP_URL}?type=${type}&t=${new Date().getTime()}`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.statusText);
        }

        const data = await response.json();
        
        if (type === 'settings') {
            document.getElementById('current-code').value = data.currentCode || '';
        } else {
            renderData(data.data || []);
            calculateStats(data.data || []);
        }
        
    } catch (error) {
        console.error("데이터 로딩 중 오류 발생:", error);
        
        // Show error in table
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: red; padding: 30px;">
                    데이터를 불러오는데 실패했습니다.<br><br>
                    <small>${error.message}</small>
                </td>
            </tr>
        `;
    } finally {
        loadingSpinner.style.display = 'none';
        tableContainer.style.display = 'block';
    }
}

function renderData(data) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';

    if (!data || !Array.isArray(data) || data.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.textContent = "출석 기록이 없습니다.";
        td.style.textAlign = 'center';
        td.style.padding = '30px';
        tr.appendChild(td);
        tableBody.appendChild(tr);
        return;
    }

    // 최신 데이터가 위로 오도록 역순 정렬
    const sortedData = [...data].reverse();

    sortedData.forEach(row => {
        const tr = document.createElement('tr');
        
        // Timestamp
        const tdTime = document.createElement('td');
        tdTime.textContent = formatTimestamp(row.Timestamp || row['타임스탬프'] || row['timestamp']);
        
        // Student ID
        const tdId = document.createElement('td');
        tdId.textContent = row.StudentId || row['학번'] || row['studentId'] || '-';
        
        // Name
        const tdName = document.createElement('td');
        tdName.textContent = row.Name || row['이름'] || row['name'] || '-';
        
        // Courses
        const tdCourses = document.createElement('td');
        const courses = row.Courses || row['수강 과목'] || row['courses'] || '';
        
        // Parse courses and create badges
        const courseArray = courses.toString().split(',').map(c => c.trim()).filter(c => c);
        if (courseArray.length > 0) {
            courseArray.forEach(course => {
                const badge = document.createElement('span');
                badge.className = 'courses-badge';
                badge.textContent = course;
                tdCourses.appendChild(badge);
            });
        } else {
            tdCourses.textContent = '-';
        }

        tr.appendChild(tdTime);
        tr.appendChild(tdId);
        tr.appendChild(tdName);
        tr.appendChild(tdCourses);
        
        tableBody.appendChild(tr);
    });
}

function calculateStats(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        document.getElementById('total-records').textContent = '0';
        document.getElementById('last-attendance').textContent = '-';
        document.getElementById('today-total').textContent = '0';
        return;
    }

    // Total Records
    document.getElementById('total-records').textContent = data.length;

    // Last Attendance Time
    const lastRecord = data[data.length - 1]; // Assume original array is chronological
    document.getElementById('last-attendance').textContent = formatTimestamp(lastRecord.Timestamp || lastRecord['타임스탬프'] || lastRecord['timestamp']);

    // Today's Total
    const today = new Date().toLocaleDateString();
    const todayCount = data.filter(row => {
        const timestamp = row.Timestamp || row['타임스탬프'] || row['timestamp'];
        if (!timestamp) return false;
        
        const rowDate = new Date(timestamp).toLocaleDateString();
        return rowDate === today;
    }).length;
    
    document.getElementById('today-total').textContent = todayCount;
}

function formatTimestamp(isoString) {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString; // fallback to original string if not a valid date
        
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        
        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch (e) {
        return isoString;
    }
}

async function updateAttendanceCode() {
    const newCodeInput = document.getElementById('new-code');
    const newCode = newCodeInput.value.trim();
    
    if (!newCode) {
        alert('새로운 출석 코드를 입력해주세요.');
        return;
    }

    const btn = document.getElementById('updateCodeBtn');
    const originalText = btn.textContent;
    btn.textContent = '변경 중...';
    btn.disabled = true;

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'update_code',
                newCode: newCode
            }),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            }
        });

        const result = await response.json();
        if (result.status === 'success') {
            alert('출석 코드가 성공적으로 변경되었습니다!');
            newCodeInput.value = '';
            fetchData('settings'); // 현재 코드 다시 불러오기
        } else {
            throw new Error(result.message || '알 수 없는 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('설정 변경 오류:', error);
        alert('출석 코드 변경에 실패했습니다: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
