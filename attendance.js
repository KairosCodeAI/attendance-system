// 여기에 배포된 Google Apps Script 웹앱 URL을 입력하세요.
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby2nwFxRp_1WNqT30Bjmhx7c2lgqFSdfeyM9iABt3xTroDR3NPsmBr8jw391SMf8niz/exec";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('attendanceForm');
    const submitBtn = document.getElementById('submitBtn');
    
    // 출석 코드 입력란: 숫자만 입력 가능하도록 필터링
    const codeInput = document.getElementById('attendanceCode');
    codeInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. 데이터 수집
        const studentName = document.getElementById('studentName').value.trim();
        const studentId = document.getElementById('studentId').value.trim();
        const attendanceCode = document.getElementById('attendanceCode').value.trim();
        
        // 체크된 수강 과목 수집
        const courseCheckboxes = document.querySelectorAll('input[name="course"]:checked');
        const courses = Array.from(courseCheckboxes).map(cb => cb.value);

        // 2. 유효성 검사
        if (!studentName || !studentId) {
            showToast('이름과 학번을 입력해주세요.', 'error');
            return;
        }

        if (courses.length === 0) {
            showToast('최소 한 개 이상의 과목을 선택해주세요.', 'error');
            return;
        }

        if (attendanceCode.length !== 4) {
            showToast('출석 코드 4자리를 정확히 입력해주세요.', 'error');
            return;
        }

        // 3. UI 로딩 상태 변경
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        const payload = {
            studentName,
            studentId,
            courses,
            attendanceCode,
            timestamp: new Date().toISOString()
        };

        try {
            // 4. GAS 웹앱으로 POST 요청 전송
            // CORS Preflight OPTIONS 요청을 방지하기 위해 Content-Type: text/plain;charset=utf-8 사용
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload)
            });

            // GAS가 JSON을 반환한다고 가정
            let result;
            try {
                result = await response.json();
            } catch (jsonErr) {
                // JSON 파싱 에러 또는 URL이 유효하지 않은 경우
                throw new Error("서버에서 올바른 응답을 받지 못했습니다. URL을 확인해주세요.");
            }

            if (result && result.status === 'success') {
                showToast('✅ 출석이 성공적으로 처리되었습니다.', 'success');
                form.reset(); // 성공 시 폼 초기화
            } else {
                showToast(result.message || '출석 처리에 실패했습니다.', 'error');
            }
        } catch (error) {
            console.error('Error submitting attendance:', error);
            showToast(error.message || '서버와 통신 중 오류가 발생했습니다. URL이 올바른지 확인해주세요.', 'error');
        } finally {
            // 버튼 상태 복구
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });
});

// 프리미엄 토스트 알림 표시 함수
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // 아이콘 설정
    const icon = type === 'success' ? '✓' : '✕';
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);

    // 3.5초 후 사라짐 애니메이션 적용 및 DOM에서 제거
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 400);
    }, 3500);
}
