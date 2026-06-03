/**
 * 구글 앱스 스크립트(Google Apps Script) 백엔드 코드입니다.
 * 이 코드를 복사하여 구글 스프레드시트의 [확장 프로그램] -> [Apps Script] 편집기에 붙여넣기 하세요.
 * 
 * [필수 준비 사항]
 * 1. 구글 스프레드시트에 다음 3개의 시트를 만들어야 합니다: '설정', '수강신청', '출석기록'
 * 2. '설정' 시트의 A1 셀에는 "오늘의 출석코드", B1 셀에는 실제 비밀번호(예: 1234)를 입력하세요.
 * 3. 작성 완료 후 우측 상단의 [배포] -> [새 배포] -> 유형을 '웹 앱'으로 선택하여 배포하세요.
 * 4. 엑세스 권한은 '모든 사용자'로 설정해야 학생들이 접근할 수 있습니다.
 */

// 스프레드시트의 시트 이름 설정
const SETTINGS_SHEET_NAME = '설정';
const REGISTRATION_SHEET_NAME = '수강신청';
const ATTENDANCE_SHEET_NAME = '출석기록';

/**
 * doGet(e) 함수
 * 관리자 대시보드(HTML) 등에서 GET 요청을 보낼 때 실행됩니다.
 * 현재 '출석기록' 시트의 데이터를 읽어서 웹페이지에 전달(JSON 형태)합니다.
 */
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATTENDANCE_SHEET_NAME);
    
    // 출석기록 시트가 없을 경우 에러 메시지 반환
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({status: "error", message: "출석기록 시트를 찾을 수 없습니다."}))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // 데이터가 있는 전체 범위를 가져옵니다.
    var data = sheet.getDataRange().getValues();

    // 첫 번째 줄(보통 헤더: 타임스탬프, 학번 등)을 제외한 나머지 데이터를 배열로 변환합니다.
    var records = [];
    for (var i = 1; i < data.length; i++) {
      records.push({
        timestamp: data[i][0],    // 타임스탬프 (출석 시간)
        studentId: data[i][1],    // 학번
        studentName: data[i][2],  // 이름
        courses: data[i][3]       // 신청 과목
      });
    }

    // 추출한 데이터를 JSON 형식(웹에서 읽기 쉬운 형태)으로 반환합니다.
    return ContentService.createTextOutput(JSON.stringify({status: "success", data: records}))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // 오류 발생 시 오류 내용을 반환합니다.
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.message}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * doPost(e) 함수
 * 학생 출석 페이지(HTML)에서 "출석하기" 버튼을 눌러 POST 요청을 보낼 때 실행됩니다.
 * 전달받은 출석 코드를 확인하고 맞으면 출석 기록을 저장합니다.
 */
function doPost(e) {
  try {
    // 클라이언트(학생 화면)에서 보낸 데이터를 자바스크립트 객체로 변환합니다.
    var payload = JSON.parse(e.postData.contents);

    var studentName = payload.studentName;
    var studentId = payload.studentId;
    var courses = payload.courses; // 배열(예: ['인공지능', '미술']) 또는 문자열
    var attendanceCode = payload.attendanceCode;

    // 1. 현재 연결된 스프레드시트 열기 및 '설정' 시트 가져오기
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);

    // 설정 시트가 없는 경우 에러 처리
    if (!settingsSheet) {
      return ContentService.createTextOutput(JSON.stringify({status: "error", message: "'설정' 시트를 찾을 수 없습니다. 시트 이름을 확인하세요."}))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. 오늘의 출석 코드 확인 (설정 시트의 B1 셀에 출석 코드가 있다고 가정합니다)
    // 공백을 제거하고 문자열로 변환하여 정확히 비교합니다.
    var actualCode = settingsSheet.getRange("B1").getValue().toString().trim();
    var submittedCode = attendanceCode.toString().trim();

    // 대리 출석 방지: 학생이 입력한 코드와 B1 셀의 코드가 다르면 에러를 반환합니다.
    if (actualCode !== submittedCode) {
      return ContentService.createTextOutput(JSON.stringify({status: "error", message: "출석 코드가 일치하지 않습니다."}))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. 코드가 일치하면 '출석기록' 시트에 데이터를 추가합니다.
    var attendanceSheet = ss.getSheetByName(ATTENDANCE_SHEET_NAME);
    if (!attendanceSheet) {
      // 출석기록 시트가 실수로 지워진 경우 자동으로 생성하고 첫 줄(헤더)을 작성합니다.
      attendanceSheet = ss.insertSheet(ATTENDANCE_SHEET_NAME);
      attendanceSheet.appendRow(['타임스탬프', '학번', '이름', '신청과목']);
    }

    // 신청 과목 데이터가 배열일 경우(예: ['수학', '영어']) 콤마로 구분된 문자열('수학, 영어')로 변환합니다.
    var coursesString = Array.isArray(courses) ? courses.join(', ') : courses;

    // 현재 시간을 가져옵니다.
    var now = new Date();

    // 출석기록 시트의 마지막 줄에 [출석시간, 학번, 이름, 과목] 정보를 새롭게 한 줄 추가합니다.
    attendanceSheet.appendRow([now, studentId, studentName, coursesString]);

    // 4. 모든 과정이 성공적으로 끝나면 성공 메시지를 반환합니다.
    return ContentService.createTextOutput(JSON.stringify({status: "success"}))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // 중간에 예상치 못한 오류가 발생하면 에러 메시지를 반환합니다.
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.message}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
