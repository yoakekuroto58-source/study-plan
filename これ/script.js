let originalDaysLeft = 0;
let daysArray = []; 
let studyPool = []; 
let defaultDailyHours = 2; 
let selectedOffDays = []; 
let testDateGlobal = null;
let baseSubjectsGlobal = []; 
let weakSubjectsGlobal = []; 
let totalCompletedCount = 0;
let totalExtraCount = 0;

// タイマー用変数
let timerInterval = null;
let timerSeconds = 25 * 60;
let isTimerRunning = false;

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

window.onload = async function() {
    const today = new Date();
    today.setDate(today.getDate() + 14);
    document.getElementById('test-date').value = getLocalDateString(today);
    updateWeakSubjectOptions();

    // ① local restore
    loadData();

    // ② if logged in, load GAS plan
    const loginUserId = localStorage.getItem("loginUserId");
    const selectedGrade = localStorage.getItem("selectedGrade");

		if (selectedGrade) {
			GAS_URL = GAS_URLS[selectedGrade];
		}

   if (loginUserId) {

    // ① まずGASから計画表を読み込む
    await loadPlanFromGAS();


    // ③ 学習履歴が保存されたあとに
    //    ステータスと連続学習日数を読み込む
await loadStatusFromGAS();
await loadStreakFromGAS();

    // ④ 最後にマイページを表示
    renderMyPage();

} else {
    renderMiniCalendarPicker();
    updatePlanTypeUI();
};
};
/* --- ローカルストレージ保存 & 復元 --- */
function loadData() {
    const savedStr = localStorage.getItem('studyPlanData');
    if (!savedStr) return false;

    try {
        const data = JSON.parse(savedStr);
        daysArray = data.daysArray || [];
        if (data.testDate) testDateGlobal = new Date(data.testDate);
        baseSubjectsGlobal = data.baseSubjects || [];
        weakSubjectsGlobal = data.weakSubjects || [];
        defaultDailyHours = data.defaultDailyHours || 2;
        selectedOffDays = data.selectedOffDays || [];

        if (data.testDate) document.getElementById('test-date').value = data.testDate;
        if (data.subjectInputValue) document.getElementById('subject-input').value = data.subjectInputValue;
        if (data.defaultDailyHours) document.getElementById('daily-hours').value = data.defaultDailyHours;

        if (data.planType) {
            const radio = document.querySelector(`input[name="planType"][value="${data.planType}"]`);
            if (radio) radio.checked = true;
        }

        if (data.weakRatio) {
            const radio = document.querySelector(`input[name="weakRatio"][value="${data.weakRatio}"]`);
            if (radio) radio.checked = true;
        }

        updateWeakSubjectOptions();

        // 苦手チェックボックスの復元
        const checkboxes = document.querySelectorAll('#weak-subjects-checkboxes input');
        checkboxes.forEach(cb => {
            if (weakSubjectsGlobal.includes(cb.value)) cb.checked = true;
        });

        renderMiniCalendarPicker();
        
        // 画面表示
        document.getElementById('result-layout').style.display = 'grid';
        document.getElementById('reset-plan-btn').style.display = 'block';
        
        // 保存済みの daysArray（タスクとチェック状態）をそのまま描画
        renderCalendar();
        renderChecker();
        updateDashboard();

        return true;
    } catch (e) {
        console.error("データのロードに失敗しました", e);
        return false;
    }
}

// ===============================
// ステータスをGASから読み込み
// ===============================
async function loadStatusFromGAS() {
    const userId = localStorage.getItem("loginUserId");

    if (!userId) return;

    try {
        const params = new URLSearchParams({
    action: "loadStatus",
    userId: userId
});

const response = await fetch(
    GAS_URL + "?" + params.toString()
);

        const result = await response.json();

        if (result.success) {
            totalCompletedCount = Number(result.completedCount) || 0;
            totalExtraCount = Number(result.extraCount) || 0;

            console.log(
                "ステータス読み込み完了：",
                totalCompletedCount,
                totalExtraCount
            );
        }

    } catch (error) {
        console.error("ステータス読み込みエラー：", error);
    }
}
// ===============================
// 連続学習日数をGASから読み込み
// ===============================
async function loadStreakFromGAS() {
    const userId = localStorage.getItem("loginUserId");

    if (!userId) return;

    try {
        const params = new URLSearchParams({
            action: "loadStreak",
            userId: userId
        });

        const response = await fetch(
            GAS_URL + "?" + params.toString()
        );

        const result = await response.json();

		if (result.success) {
			document.getElementById("dash-streak").textContent =
				` ${result.streak}日`;

			console.log("連続学習読み込み完了：", result.streak);
	}

    } catch (error) {
        console.error("連続学習読み込みエラー：", error);
    }
}
// ===============================
// GASから保存済みの計画表を読み込み
// ===============================
async function loadPlanFromGAS() {
    const userId = localStorage.getItem("loginUserId");

    if (!userId) return false;

    try {
        const response = await fetch(
            GAS_URL +
            "?action=loadPlan" +
            "&userId=" + encodeURIComponent(userId)
        );

        const result = await response.json();

        if (!result.success) {
            console.error("計画表の読み込み失敗：", result.message);
            return false;
        }

        // まだ計画表が保存されていない場合
        if (!result.planJson) {
            console.log("保存済みの計画表はありません");
            return false;
        }

        // JSONをJavaScriptのデータに戻す
        const data = JSON.parse(result.planJson);

        daysArray = data.daysArray || [];

        if (data.testDate) {
            testDateGlobal = new Date(data.testDate);
        }

        baseSubjectsGlobal = data.baseSubjects || [];
        weakSubjectsGlobal = data.weakSubjects || [];
        defaultDailyHours = data.defaultDailyHours || 2;
        selectedOffDays = data.selectedOffDays || [];

        // 入力欄も復元
        if (data.testDate) {
            document.getElementById("test-date").value = data.testDate;
        }

        if (data.subjectInputValue) {
            document.getElementById("subject-input").value =
                data.subjectInputValue;
        }

        if (data.defaultDailyHours) {
            document.getElementById("daily-hours").value =
                data.defaultDailyHours;
        }

        // モードを復元
        if (data.planType) {
            const radio = document.querySelector(
                `input[name="planType"][value="${data.planType}"]`
            );

            if (radio) radio.checked = true;
        }

        // 苦手科目の倍率を復元
        if (data.weakRatio) {
            const radio = document.querySelector(
                `input[name="weakRatio"][value="${data.weakRatio}"]`
            );

            if (radio) radio.checked = true;
        }

        updateWeakSubjectOptions();

        // 苦手科目のチェックを復元
        const checkboxes = document.querySelectorAll(
            "#weak-subjects-checkboxes input"
        );

        checkboxes.forEach(cb => {
            cb.checked = weakSubjectsGlobal.includes(cb.value);
        });

       // マイページを表示中なら、計画画面を勝手に出さない
const mypage = document.getElementById("mypage");

// 計画が保存されている場合だけ表示
if (daysArray.length > 0) {
    document.getElementById("result-layout")
        .style.setProperty("display", "grid", "important");

    document.getElementById("reset-plan-btn").style.display = "block";
} else {
    // 計画がない場合は非表示
    document.getElementById("result-layout")
        .style.setProperty("display", "none", "important");

    document.getElementById("reset-plan-btn").style.display = "none";
}
        // 保存済みの計画表を描画
        renderMiniCalendarPicker();
        renderCalendar();
        renderChecker();
        updateDashboard();
        // 最初からチェック済みの学習履歴を保存

        console.log("GASから計画表を読み込みました！");

        return true;

    } catch (error) {
        console.error("GAS計画表読み込みエラー：", error);
        return false;
    }
}

async function saveAllLearningHistoryToGAS() {
    const promises = [];

    for (const d of daysArray) {
        const counts = getLearningCountsForDate(d.dateStr);

        if (counts.normalCount > 0 || counts.extraCount > 0) {
            promises.push(saveLearningHistoryToGAS(d.dateStr));
        }
    }

    await Promise.all(promises);
}

    // ===============================
// 今日の日付に合わせて計画を更新
// ===============================
function updateTodayPlan() {
    if (daysArray.length === 0) return;

    const todayStr = getTodayStr();

    // 今日の日付の計画を探す
    const todayObj = daysArray.find(d => d.dateStr === todayStr);

    if (!todayObj) {
        console.log("今日の計画はありません");
        renderChecker();
        updateDashboard();
        return;
    }

    // 今日の計画を表示
    renderChecker();
    renderCalendar();
    updateDashboard();

    console.log("今日の計画に更新しました！");
}

function resetSavedPlan() {
    if (confirm("保存されている計画と進捗履歴を削除してやり直しますか？")) {
        localStorage.removeItem('studyPlanData');
        location.reload();
    }
}

/* --- タイマー機能 --- */
function updateTimerDisplay() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    document.getElementById('timer-display').innerText = 
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        if (timerSeconds > 0) {
            timerSeconds--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            isTimerRunning = false;
            alert("25分間の集中タイムが終了しました！休憩しましょう。");
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
}

function resetTimer() {
    stopTimer();
    timerSeconds = 25 * 60;
    updateTimerDisplay();
}

/* --- ガイド表示切替 --- */
function toggleGuide() {
    const guide = document.getElementById('guide-box');
    guide.style.display = (guide.style.display === 'none' || guide.style.display === '') ? 'block' : 'none';
}

function updatePlanTypeUI() {
    const selectedType = document.querySelector('input[name="planType"]:checked').value;
    const cardFixed = document.getElementById('card-type-fixed');
    const cardTransfer = document.getElementById('card-type-transfer');

    if (selectedType === 'fixed') {
        cardFixed.classList.add('selected');
        cardTransfer.classList.remove('selected');
    } else {
        cardTransfer.classList.add('selected');
        cardFixed.classList.remove('selected');
    }

    if (daysArray.length > 0) {
        reallocatePlan(false);
        renderCalendar();
        renderChecker();
        updateDashboard();
        saveData();
        
        renderMyPage();
		loadStreakFromGAS();
    }
}
function updateWeakSubjectOptions() {
    const rawInput = document.getElementById('subject-input').value;
    const subjects = rawInput.split(/[,、]/).map(s => s.trim()).filter(s => s.length > 0);
    const container = document.getElementById('weak-subjects-checkboxes');
    
    const checked = [];
    container.querySelectorAll('input:checked').forEach(cb => checked.push(cb.value));

    container.innerHTML = '';
    subjects.forEach(sub => {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = sub;
        if (checked.includes(sub) || weakSubjectsGlobal.includes(sub)) cb.checked = true;

        label.appendChild(cb);
        label.appendChild(document.createTextNode(` ${sub}`));
        container.appendChild(label);
    });
}

function renderMiniCalendarPicker() {
    const container = document.getElementById('mini-calendar-picker');
    container.innerHTML = '';

    const testDateVal = document.getElementById('test-date').value;
    if (!testDateVal) return;

    const testDate = new Date(testDateVal);
    const today = new Date();
    today.setHours(0,0,0,0);

    let current = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(testDate.getFullYear(), testDate.getMonth(), 1);

    const testDateStr = getLocalDateString(testDate);

    while (current <= endMonth) {
        const year = current.getFullYear();
        const month = current.getMonth();

        const monthHeader = document.createElement('div');
        monthHeader.className = 'mini-month-header';
        monthHeader.innerText = `${year}年 ${month + 1}月`;
        container.appendChild(monthHeader);

        const grid = document.createElement('div');
        grid.className = 'mini-calendar-grid';

        const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
        weekDays.forEach(wd => {
            const head = document.createElement('div');
            head.className = 'mini-header-day';
            head.innerText = wd;
            grid.appendChild(head);
        });

        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDayIndex; i++) {
            const empty = document.createElement('div');
            empty.className = 'mini-day empty';
            grid.appendChild(empty);
        }

        for (let day = 1; day <= totalDaysInMonth; day++) {
            const cellDate = new Date(year, month, day);
            const cellDateStr = getLocalDateString(cellDate);
            const dayCell = document.createElement('div');
            dayCell.className = 'mini-day';

            const isTest = cellDateStr === testDateStr;
            const isOff = selectedOffDays.includes(cellDateStr);
            const isOutOfRange = cellDate < today || cellDate > testDate;

            dayCell.innerText = `${day}`;

            if (isOutOfRange) {
                dayCell.classList.add('disabled');
            } else if (isTest) {
                dayCell.classList.add('test-day');
                dayCell.innerText += ' (テスト)';
            } else {
                if (isOff) dayCell.classList.add('off');

                dayCell.onclick = function() {
                    if (selectedOffDays.includes(cellDateStr)) {
                        selectedOffDays = selectedOffDays.filter(d => d !== cellDateStr);
                        dayCell.classList.remove('off');
                    } else {
                        selectedOffDays.push(cellDateStr);
                        dayCell.classList.add('off');
                    }
                };
            }

            grid.appendChild(dayCell);
        }

        container.appendChild(grid);
        current.setMonth(current.getMonth() + 1);
    }
}

function updateDashboard() {
    const testDateVal = document.getElementById('test-date').value;
    const daysLeftElem = document.getElementById('dash-days-left');
    const todayTasksElem = document.getElementById('dash-today-tasks');

    if (testDateVal) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const target = new Date(testDateVal);
        const diffTime = target - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysLeftElem.innerText = diffDays > 0 ? `${diffDays} 日` : "本日本番！";
    } else {
        daysLeftElem.innerText = "-- 日";
    }
    
	const todayStr = getLocalDateString(new Date())
	const todayObj = daysArray.find(d => d.dateStr === todayStr);

    if (todayObj && todayObj.tasks) {
        todayTasksElem.innerText = `${todayObj.tasks.length} コマ`;
    } else {
        todayTasksElem.innerText = "0 コマ";
    }
}
/* --- 計画表の自動生成ボタン --- */
function generatePlan() {
    const testDateVal = document.getElementById('test-date').value;
    if (!testDateVal) {
        alert("テスト日を入力してください。");
        return;
    }

    testDateGlobal = new Date(testDateVal);
    const today = new Date();
    today.setHours(0,0,0,0);

    if (testDateGlobal <= today) {
        alert("テスト日は明日以降の日付を設定してください。");
        return;
    }

    const rawSubjects = document.getElementById('subject-input').value;
    baseSubjectsGlobal = rawSubjects.split(/[,、]/).map(s => s.trim()).filter(s => s.length > 0);
    
    if (baseSubjectsGlobal.length === 0) {
        alert("教科を1つ以上入力してください。");
        return;
    }

    weakSubjectsGlobal = [];
    document.querySelectorAll('#weak-subjects-checkboxes input:checked').forEach(cb => {
        weakSubjectsGlobal.push(cb.value);
    });

    defaultDailyHours = parseInt(document.getElementById('daily-hours').value) || 2;

    daysArray = [];
    let curr = new Date(today);
    while (curr <= testDateGlobal) {
        const dateStr = getLocalDateString(curr);
        const isTest = dateStr === getLocalDateString(testDateGlobal);
        const isOff = selectedOffDays.includes(dateStr);

        daysArray.push({
            dateStr: dateStr,
            isTestDay: isTest,
            isOffDay: isOff,
            customHours: undefined,
            tasks: []
        });

        curr.setDate(curr.getDate() + 1);
    }

    // 初回生成時のみ新規シャッフル
    reallocatePlan(true);

   document.getElementById('result-layout')
    .style.setProperty('display', 'grid', 'important');
    document.getElementById('reset-plan-btn').style.display = 'block';
    renderCalendar();
    renderChecker();
    updateDashboard();

    saveData();
    
    document.getElementById('result-layout').scrollIntoView({ behavior: 'smooth' });
}

/* --- 計画の割り当て処理 --- */
function reallocatePlan(isNewPlan = false) {
    const planType = document.querySelector('input[name="planType"]:checked').value;
    
    const weakRatioInput = document.querySelector('input[name="weakRatio"]:checked');
    const weakMultiplier = weakRatioInput ? parseFloat(weakRatioInput.value) : 2.0;

    const weights = {};
    let totalWeight = 0;
    baseSubjectsGlobal.forEach(sub => {
        const weight = weakSubjectsGlobal.includes(sub) ? weakMultiplier : 1;
        weights[sub] = weight;
        totalWeight += weight;
    });

    const availableDays = daysArray.filter(d => !d.isTestDay && !d.isOffDay);
    const totalDaysCount = daysArray.filter(d => !d.isTestDay).length;

    let totalTargetSlots = 0;

    if (planType === 'transfer') {
        totalTargetSlots = totalDaysCount * defaultDailyHours;
    } else {
        totalTargetSlots = availableDays.reduce((sum, d) => {
            const h = d.customHours !== undefined ? d.customHours : defaultDailyHours;
            return sum + h;
        }, 0);
    }

    // 新規作成時（isNewPlan = true）またはプール未設定時にプールを作成してシャッフル
    if (isNewPlan || studyPool.length === 0) {
        let allocatedSlots = {};
        if (totalTargetSlots >= baseSubjectsGlobal.length) {
            let remaining = totalTargetSlots - baseSubjectsGlobal.length;
            baseSubjectsGlobal.forEach(sub => {
                allocatedSlots[sub] = 1;
            });

            if (remaining > 0) {
                let extraSum = 0;
                baseSubjectsGlobal.forEach(sub => {
                    const ratio = weights[sub] / totalWeight;
                    const extra = Math.round(remaining * ratio);
                    allocatedSlots[sub] += extra;
                    extraSum += extra;
                });

                let diff = (baseSubjectsGlobal.length + extraSum) - totalTargetSlots;
                if (diff !== 0 && baseSubjectsGlobal.length > 0) {
                    allocatedSlots[baseSubjectsGlobal[0]] -= diff;
                }
            }
        } else {
            baseSubjectsGlobal.forEach(sub => {
                allocatedSlots[sub] = 1;
            });
        }

        studyPool = [];
        baseSubjectsGlobal.forEach(sub => {
            const count = allocatedSlots[sub] || 1;
            for (let i = 0; i < count; i++) {
                studyPool.push(sub);
            }
        });

        shuffleArray(studyPool);
    }

    let poolIndex = 0;

    daysArray.forEach(d => {
        if (d.isTestDay) {
            d.tasks = [{ subject: '★ テスト本番！', done: false, isTest: true }];
            return;
        }

        if (d.isOffDay) {
            d.tasks = [];
            return;
        }

        let hours = defaultDailyHours;
        if (planType === 'transfer') {
            if (availableDays.length > 0) {
                const baseH = Math.floor(totalTargetSlots / availableDays.length);
                const remainder = totalTargetSlots % availableDays.length;
                const dayIndex = availableDays.indexOf(d);
                hours = dayIndex < remainder ? baseH + 1 : baseH;
            }
        }

        if (d.customHours !== undefined) {
            hours = d.customHours;
        }

        // 既存タスクのチェック状態（done）のみ記憶
        const oldDoneMap = {};
        if (d.tasks) {
            d.tasks.forEach(t => { 
                oldDoneMap[t.subject] = t.done;
            });
        }

        // 追加・増加される教科用のランダムプール作成（対象教科からシャッフルして取得）
        let randomSubjects = shuffleArray([...baseSubjectsGlobal]);

        d.tasks = [];
        for (let h = 0; h < hours; h++) {
            let sub = "";

            if (poolIndex < studyPool.length) {
                sub = studyPool[poolIndex];
                poolIndex++;
            } else {
                // プールを超えて時間枠が増えた場合はランダムに教科を選択
                sub = randomSubjects[h % randomSubjects.length];
            }

            d.tasks.push({
                subject: sub,
                done: oldDoneMap[sub] !== undefined ? oldDoneMap[sub] : false
            });
        }
    });
}

/* --- チェッカーのチェック切り替え --- */
async function toggleTaskDone(dateStr, taskIndex) {
    const dayObj = daysArray.find(d => d.dateStr === dateStr);

    if (dayObj && dayObj.tasks[taskIndex]) {
        const task = dayObj.tasks[taskIndex];

        // チェック前の状態
        const wasDone = task.done;

        // チェック状態を反転
        task.done = !task.done;

        // 未チェック → チェック
        if (!wasDone && task.done) {
            if (task.isExtra) {
                totalExtraCount++;
            } else {
                totalCompletedCount++;
            }
        }

        // チェック → 未チェック
        if (wasDone && !task.done) {
            if (task.isExtra) {
                totalExtraCount--;
            } else {
                totalCompletedCount--;
            }
        }

        // 画面更新
        renderChecker();
        renderCalendar();
        renderMyPage();

        // 保存
        saveData();
        await saveStatusToGAS();

        // 学習履歴を保存してから連続学習を再計算
        await saveLearningHistoryToGAS(dateStr);
        await loadStreakFromGAS();
    }
}




function addExtraStudy() {
    const todayStr = getLocalDateString(new Date());
    const todayObj = daysArray.find(d => d.dateStr === todayStr);

    // 今日の計画がない
    if (!todayObj) {
        alert("今日の学習計画がありません！");
        return;
    }

    // テスト日
    if (todayObj.isTestDay) {
        alert("今日はテスト本番なので、追加の勉強はできません！");
        return;
    }

    // 休みの日
    if (todayObj.isOffDay) {
        alert("今日はお休みの日です！");
        return;
    }

    // 今日すでに勉強する科目を取得
    const todaySubjects = todayObj.tasks
        .filter(task => !task.isTest)
        .map(task => task.subject);

    // 今日まだ入っていない科目を優先
    let candidates = baseSubjectsGlobal.filter(
        subject => !todaySubjects.includes(subject)
    );

    // 全科目が入っていたら、全科目から選ぶ
    if (candidates.length === 0) {
        candidates = [...baseSubjectsGlobal];
    }

    // ランダムに1科目選ぶ
    const subject = candidates[
        Math.floor(Math.random() * candidates.length)
    ];

    // 追加タスクを今日だけに追加
    todayObj.tasks.push({
        subject: subject,
        done: false,
        isExtra: true
    });

    // 画面更新
    renderChecker();
    renderCalendar();
    updateDashboard();

    // 保存
    saveData();

    alert(`${subject}を追加しました！`);
}
function renderChecker() {
    const todayStr = getLocalDateString(new Date());
    
    const todayBox = document.getElementById('today-tasks-box');
    const upcomingBox = document.getElementById('upcoming-tasks-box');
    const pastBox = document.getElementById('past-tasks-box');

    todayBox.innerHTML = '';
    upcomingBox.innerHTML = '';
    pastBox.innerHTML = '';

    let totalTasks = 0;
    let checkedTasks = 0;

    daysArray.forEach(d => {
        if (d.isTestDay) return;

        d.tasks.forEach((task, idx) => {
            totalTasks++;
            if (task.done) checkedTasks++;

            const item = document.createElement('div');
            item.className = 'checker-item';

            const label = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = task.done;
            cb.onchange = () => toggleTaskDone(d.dateStr, idx);

            const dateBadge = document.createElement('span');
            dateBadge.className = 'task-date-badge';
            dateBadge.innerText = d.dateStr;

            const subjectText = document.createElement('span');
            subjectText.className = 'task-subject-text';
            if (task.done) subjectText.classList.add('done');
            subjectText.innerText = task.subject;

            label.appendChild(cb);
            label.appendChild(dateBadge);
            label.appendChild(subjectText);
            item.appendChild(label);

            if (d.dateStr === todayStr) {
                todayBox.appendChild(item);
            } else if (d.dateStr > todayStr) {
                upcomingBox.appendChild(item);
            } else {
                pastBox.appendChild(item);
            }
        });
    });

    if (todayBox.children.length === 0) {
        todayBox.innerHTML = '<p class="empty-msg">今日の勉強タスクはありません（お休みまたはテスト日）</p>';
    }

    const percent = totalTasks > 0 ? Math.round((checkedTasks / totalTasks) * 100) : 0;
    document.getElementById('percent-disp').innerText = `${checkedTasks} / ${totalTasks} コマ (${percent}%)`;
    document.getElementById('bar-fill-disp').style.width = `${percent}%`;

  const level = Math.floor(
    (totalCompletedCount + totalExtraCount) / 3
) + 1;

    let title = "のび太級";
    if (level >= 15) title = "勉強神級 ";
    else if (level >= 10) title = "天才級 ";
    else if (level >= 7) title = "秀才級 ";
    else if (level >= 4) title = "努力家級 ";
    else if (level >= 2) title = "見習い級 ";

    document.getElementById('title-disp').innerText = title;
}

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    container.innerHTML = '';

    if (!testDateGlobal || daysArray.length === 0) return;

    const testDateStr = getLocalDateString(testDateGlobal);
	const todayStr = getLocalDateString(new Date())
    const startDate = new Date(daysArray[0].dateStr);
    const endDate = new Date(testDateGlobal);

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= endMonth) {
        const year = current.getFullYear();
        const month = current.getMonth();

        const monthHeader = document.createElement('div');
        monthHeader.className = 'calendar-month-header';
        monthHeader.innerText = `${year}年 ${month + 1}月`;
        container.appendChild(monthHeader);

        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
        weekDays.forEach(wd => {
            const head = document.createElement('div');
            head.className = 'calendar-header-day';
            head.innerText = wd;
            grid.appendChild(head);
        });

        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDayIndex; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            grid.appendChild(empty);
        }

        for (let day = 1; day <= totalDaysInMonth; day++) {
            const cellDate = new Date(year, month, day);
            const cellDateStr = getLocalDateString(cellDate);
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';

            const dayObj = daysArray.find(d => d.dateStr === cellDateStr);

            if (cellDateStr === todayStr) dayCell.classList.add('today');
            if (cellDateStr === testDateStr) dayCell.classList.add('test-day-cell');
            if (dayObj && dayObj.isOffDay) dayCell.classList.add('off-day');

           if (dayObj && cellDateStr >= todayStr && cellDateStr !== testDateStr) {
                dayCell.onclick = function() {
                    let currentHours = dayObj.isOffDay ? 0 : (dayObj.customHours !== undefined ? dayObj.customHours : defaultDailyHours);
                    let nextHours = (currentHours + 1) % 11;

                    if (nextHours === 0) {
                        dayObj.isOffDay = true;
                        dayObj.customHours = 0;
                        dayObj.tasks = [];
                    } else {
                        dayObj.isOffDay = false;
                        dayObj.customHours = nextHours;

                        // 0時間から増やす場合や追加枠の教科をランダムに配置
                        let newSubjects = shuffleArray([...baseSubjectsGlobal]);
                        dayObj.tasks = [];
                        for (let h = 0; h < nextHours; h++) {
                            dayObj.tasks.push({
                                subject: newSubjects[h % newSubjects.length],
                                done: false
                            });
                        }
                    }

                    reallocatePlan(false);
                    renderCalendar();
                    renderChecker();
                    updateDashboard();
                    saveData();
                };
            }

            const numLabel = document.createElement('div');
            numLabel.className = 'day-num';
            if (cellDateStr === todayStr) numLabel.classList.add('today-label');
            if (cellDateStr === testDateStr) numLabel.classList.add('test-label');

            let labelText = `${day}`;
            if (cellDateStr === todayStr) labelText += " (今日)";
            numLabel.innerText = labelText;

            if (dayObj && !dayObj.isOffDay && cellDateStr !== testDateStr) {
                const hours = dayObj.tasks ? dayObj.tasks.length : defaultDailyHours;
                const badge = document.createElement('span');
                badge.className = 'hours-badge';
                badge.innerText = `${hours}h枠`;
                numLabel.appendChild(badge);
            }
            dayCell.appendChild(numLabel);

            const taskContainer = document.createElement('div');
            taskContainer.className = 'task-container';

            if (dayObj) {
                if (dayObj.isOffDay) {
                    const el = document.createElement('div');
                    el.className = 'task-item no-study-day';
                    el.innerText = "用事（お休み）";
                    taskContainer.appendChild(el);
                } else {
                    dayObj.tasks.forEach(task => {
                        const el = document.createElement('div');
                        el.className = task.done ? 'task-item done' : 'task-item todo';
                        el.innerText = `${task.subject} (1h)`;
                        taskContainer.appendChild(el);
                    });
                }
            } else if (cellDateStr === testDateStr) {
                const el = document.createElement('div');
                el.className = 'task-item test-day';
                el.innerText = "★ テスト本番！";
                taskContainer.appendChild(el);
            }

            dayCell.appendChild(taskContainer);
            grid.appendChild(dayCell);
        }

        container.appendChild(grid);
        current.setMonth(current.getMonth() + 1);
    }
}
/* ログイン、新規登録、パスワード変更処理 */
window.addEventListener("DOMContentLoaded", function () {

    const loginUserId =
        localStorage.getItem("loginUserId");

    const loginUserName =
        localStorage.getItem("loginUserName");

    const selectedGrade =
        localStorage.getItem("selectedGrade");

    // ログイン済み ＋ 学年も保存されている
    if (loginUserId && loginUserName && selectedGrade) {

        // 学年に対応するGASを設定
        GAS_URL = GAS_URLS[selectedGrade];

        // 学年選択画面を隠す
        document.getElementById("grade-select-page").style.display = "none";

        // ログイン画面を隠す
        document.getElementById("login-page").style.display = "none";

        // メイン画面を表示
        document.getElementById("main-page").style.display = "block";

        showLoginStatus();

    } else {

        // ログイン情報がない場合
        document.getElementById("grade-select-page").style.display = "flex";

        document.getElementById("login-page").style.display = "none";

        document.getElementById("main-page").style.display = "none";
    }
});

// ===============================
// 学年ごとのGAS URL
// ===============================

const GAS_URLS = {
    "1": "https://script.google.com/macros/s/AKfycbzru9yeakTni43zqZYev1xMmPJzBx_jOT3k__xUw0fqzrQKbGTnEM48qMpwr9LEhgvyQQ/exec",
    "2": "https://script.google.com/macros/s/AKfycbyELk5VDHJ4EjNR0U-mpCI3vNZa9ITeULfZnHphSiXOtP_o8vEG2xo5MWe3sa8QSq9IJg/exec",
    "3": "https://script.google.com/macros/s/AKfycbw5pMNhDEF6rM016ZuQEzJaRRrAufGE7lvfnXQ809syJx6JdZrToRoJStw55qsH3yfu/exec"
};

let GAS_URL = "";
// ===============================
// 学年を選択
// ===============================

function selectGrade(grade) {

    // 選んだ学年を保存
    localStorage.setItem("selectedGrade", grade);

    // 学年に対応するGASを選択
    GAS_URL = GAS_URLS[grade];

    // 学年選択画面を隠す
    document.getElementById("grade-select-page").style.display = "none";

    // ログイン画面を表示
    document.getElementById("login-page").style.display = "flex";
}

async function login() {
    const userId = document.getElementById("login-id").value.trim();
    const password = document.getElementById("login-password").value;

    const errorMessage = document.getElementById("login-error");

    errorMessage.textContent = "";

    if (userId === "" || password === "") {
        errorMessage.textContent =
            "ユーザーIDとパスワードを入力してね。";
        return;
    }

    try {
        const response = await fetch(
            GAS_URL +
            "?action=login" +
            "&userId=" + encodeURIComponent(userId) +
            "&password=" + encodeURIComponent(password)
        );

        const result = await response.json();
		console.log("★ GASから受け取ったステータス:", result);
        if (result.success) {
            // ログイン情報を保存
            localStorage.setItem("loginUserId", userId);
            localStorage.setItem("loginUserName", result.name);

            // ログイン画面を隠す
            document.getElementById("login-page").style.display = "none";

            // 学習計画メーカーを表示
            document.getElementById("main-page").style.display = "block";

			showLoginStatus();

await loadPlanFromGAS();

await loadStatusFromGAS();
await loadStreakFromGAS();
			
        } else {
            errorMessage.textContent =
                "ユーザーIDまたはパスワードが違います。";
        }

    } catch (error) {
        console.error(error);

        errorMessage.textContent =
            "ログインに失敗しました。GASの設定を確認してね。";
    }
}
function hideAllAuthPages() {
    document.getElementById("login-page").style.display = "none";
    document.getElementById("register-page").style.display = "none";
    document.getElementById("reset-page").style.display = "none";
}

function showLogin() {
    hideAllAuthPages();

    document.getElementById("login-page").style.display = "flex";
}

function showRegister() {
    hideAllAuthPages();

    document.getElementById("register-page").style.display = "flex";
}

function showResetPassword() {
    hideAllAuthPages();

    document.getElementById("reset-page").style.display = "flex";
}
async function registerUser() {
    const name = document.getElementById("register-name").value.trim();
    const userId = document.getElementById("register-id").value.trim();
    const password = document.getElementById("register-password").value;

    const errorMessage = document.getElementById("register-error");

    errorMessage.textContent = "";

    if (name === "" || userId === "" || password === "") {
        errorMessage.textContent =
            "すべての項目を入力してね。";
        return;
    }

    try {
        const response = await fetch(
            GAS_URL +
            "?action=register" +
            "&name=" + encodeURIComponent(name) +
            "&userId=" + encodeURIComponent(userId) +
            "&password=" + encodeURIComponent(password)
        );

        const result = await response.json();

        if (result.success) {
            // ログイン情報を保存
            localStorage.setItem("loginUserId", userId);
            localStorage.setItem("loginUserName", result.name);

            // 新規登録画面を隠す
            document.getElementById("register-page").style.display = "none";

            // 学習計画メーカーを表示
            document.getElementById("main-page").style.display = "block";

            // ログイン中の表示
          showLoginStatus();

await loadPlanFromGAS();
await saveAllLearningHistoryToGAS();

await Promise.all([
    loadStatusFromGAS(),
    loadStreakFromGAS()
]);
            // 入力欄を空にする
            document.getElementById("register-name").value = "";
            document.getElementById("register-id").value = "";
            document.getElementById("register-password").value = "";

        } else {
            errorMessage.textContent =
                result.message || "登録に失敗しました。";
        }

    } catch (error) {
        console.error(error);

        errorMessage.textContent =
            "登録に失敗しました。GASの設定を確認してね。";
    }
}
function showLoginStatus() {
    const userName = localStorage.getItem("loginUserName");

    const status = document.getElementById("login-status");

    if (userName) {
        status.textContent = `ログイン中：${userName}さん`;
    } else {
        status.textContent = "ログイン中";
    }
}

function logout() {

    // 保存していたログイン情報を削除
    localStorage.removeItem("loginUserId");
    localStorage.removeItem("loginUserName");

    // 学年もリセット
    localStorage.removeItem("selectedGrade");

    // GAS URLもリセット
    GAS_URL = "";

    // 学習計画メーカーを隠す
    document.getElementById("main-page").style.display = "none";

    // ログイン画面を隠す
    document.getElementById("login-page").style.display = "none";

    // 学年選択画面を表示
    document.getElementById("grade-select-page").style.display = "flex";

    // 入力欄を空にする
    document.getElementById("login-id").value = "";
    document.getElementById("login-password").value = "";

    // ログイン中の表示を消す
    document.getElementById("login-status").textContent = "";
}
// ===============================
// ステータスをGASに保存
// ===============================
async function saveStatusToGAS() {
    const userId = localStorage.getItem("loginUserId");

    if (!userId) return;

    const params = new URLSearchParams({
        action: "saveStatus",
        userId: userId,
        completedCount: String(totalCompletedCount),
        extraCount: String(totalExtraCount)
    });

    try {
        const response = await fetch(
            GAS_URL + "?" + params.toString()
        );

        const result = await response.json();

        if (result.success) {
            console.log("ステータスを保存しました！");
        } else {
            console.error("ステータス保存失敗：", result.message);
        }

    } catch (error) {
        console.error("ステータス保存エラー：", error);
    }
}

// ===============================
// 指定した日の学習コマ数を取得
// ===============================
function getLearningCountsForDate(dateStr) {
    const dayObj = daysArray.find(d => d.dateStr === dateStr);

    if (!dayObj || !dayObj.tasks) {
        return {
            normalCount: 0,
            extraCount: 0
        };
    }

    let normalCount = 0;
    let extraCount = 0;

    dayObj.tasks.forEach(task => {
        // 未チェック・テスト本番は数えない
        if (!task.done || task.isTest) return;

        if (task.isExtra) {
            extraCount++;
        } else {
            normalCount++;
        }
    });

    return {
        normalCount,
        extraCount
    };
}

// ===============================
// 今日の学習コマ数を取得
// ===============================
function getTodayLearningCounts() {

    const todayStr = getLocalDateString(new Date());

    return getLearningCountsForDate(todayStr);
}

// ===============================
// 学習履歴をGASに保存
// ===============================
async function saveLearningHistoryToGAS(dateStr) {
    const userId = localStorage.getItem("loginUserId");

    if (!userId) return;

    const counts = getLearningCountsForDate(dateStr);

    const params = new URLSearchParams({
        action: "saveLearningHistory",
        userId: userId,
        date: dateStr,
        normalCount: String(counts.normalCount),
        extraCount: String(counts.extraCount)
    });

    try {
        const response = await fetch(
            GAS_URL + "?" + params.toString()
        );

        const result = await response.json();

        if (result.success) {
            console.log(
                `${dateStr}の学習履歴を保存しました！`
            );
        } else {
            console.error(
                "学習履歴保存失敗：",
                result.message
            );
        }

    } catch (error) {
        console.error(
            "学習履歴保存エラー：",
            error
        );
    }
}
// ===============================
// 学習計画を保存
// ===============================
/* --- 保存 & 復元 --- */
async function saveData() {

    // ① まず今までどおりブラウザにも保存
    if (daysArray.length === 0) return;

    const dataToSave = {
        daysArray: daysArray,
        testDate: testDateGlobal ? getLocalDateString(testDateGlobal) : null,
        baseSubjects: baseSubjectsGlobal,
        weakSubjects: weakSubjectsGlobal,
        defaultDailyHours: defaultDailyHours,
        selectedOffDays: selectedOffDays,
        planType: document.querySelector('input[name="planType"]:checked').value,
        weakRatio: document.querySelector('input[name="weakRatio"]:checked').value,
        subjectInputValue: document.getElementById('subject-input').value
    };

    localStorage.setItem('studyPlanData', JSON.stringify(dataToSave));


    // ② Googleスプレッドシートにも保存
    const userId = localStorage.getItem("loginUserId");

    if (!userId) {
        console.log("ログインしていないため、GAS保存をスキップ");
        return;
    }

    const mode = document.querySelector('input[name="planType"]:checked').value;

   const params = new URLSearchParams({
    action: "savePlan",
    userId: userId,
    mode: mode,
    testDate: document.getElementById("test-date").value,
    offDays: selectedOffDays.join(","),
    subjects: baseSubjectsGlobal.join(","),
    weakSubjects: weakSubjectsGlobal.join(","),
    weakRatio: document.querySelector('input[name="weakRatio"]:checked').value,
    defaultDailyHours: String(defaultDailyHours),
    planJson: JSON.stringify(dataToSave)
});

console.log("基本勉強時間:", defaultDailyHours);
console.log("送信データ:", params.toString());
    try {

        const response = await fetch(
            GAS_URL + "?" + params.toString()
        );

        const result = await response.json();

        if (result.success) {
            console.log("Googleスプレッドシートに保存しました！");
        } else {
            console.error("GAS保存失敗：", result.message);
        }

    } catch (error) {

        console.error("GAS保存エラー：", error);

    }

}

function renderMyPage() {

    console.log("=== マイページ ===");
    console.log("通常:", totalCompletedCount);
    console.log("追加:", totalExtraCount);

    // ログイン中の名前を表示
    const userName = localStorage.getItem("loginUserName") || "ゲスト";
    document.getElementById("mypage-name").textContent = userName;

document.getElementById("stat-completed").textContent =
    `${totalCompletedCount} コマ`;

document.getElementById("stat-extra").textContent =
    `${totalExtraCount} コマ`;
    
    const totalStudyMinutes =
    (totalCompletedCount + totalExtraCount) * 60;

const totalStudyHours = Math.floor(totalStudyMinutes / 60);
const totalStudyMinutesRest = totalStudyMinutes % 60;

document.getElementById("stat-study-time").textContent =
    totalStudyMinutesRest === 0
        ? `${totalStudyHours}時間`
        : `${totalStudyHours}時間${totalStudyMinutesRest}分`;
        
    // =========================
    // やり込みステータス
    // =========================

    const totalCount =
        totalCompletedCount + totalExtraCount;

    const level =
        Math.floor(totalCount / 3) + 1;

    document.getElementById("mypage-level-disp").textContent =
        `Lv.${level}`;

    let title = "のび太級";

    if (level >= 15) {
        title = "勉強神級";
    } else if (level >= 10) {
        title = "天才級";
    } else if (level >= 7) {
        title = "秀才級";
    } else if (level >= 4) {
        title = "努力家級";
    } else if (level >= 2) {
        title = "見習い級";
    }

    document.getElementById("mypage-title-disp").textContent =
        title;

    // 進捗バー
    const currentLevelCount = totalCount % 3;
    const percent =
        Math.round((currentLevelCount / 3) * 100);

    document.getElementById("mypage-bar-fill-disp").style.width =
        `${percent}%`;

    document.getElementById("mypage-percent-disp").textContent =
        `${totalCount} コマ`;
        renderLearningHistory();
}

        // ===============================
// マイページ：学習記録を表示
// ===============================
function renderLearningHistory() {
    const container = document.getElementById("learning-history-list");

    if (!container) return;

    container.innerHTML = "";

    const records = [];

    // 日付ごとに調べる
    daysArray.forEach(day => {

        if (!day.tasks || day.tasks.length === 0) return;

        // 実際に勉強済みのタスクだけ
        const completedTasks = day.tasks.filter(task =>
            task.done && !task.isTest
        );

        if (completedTasks.length === 0) return;

        // 科目ごとに集計
        const subjectCounts = {};

        completedTasks.forEach(task => {

            if (!subjectCounts[task.subject]) {
                subjectCounts[task.subject] = {
                    normal: 0,
                    extra: 0
                };
            }

            if (task.isExtra) {
                subjectCounts[task.subject].extra++;
            } else {
                subjectCounts[task.subject].normal++;
            }
        });

        const dailyCount = completedTasks.length;

records.push({
    date: day.dateStr,
    subjects: subjectCounts,
    totalCount: dailyCount
});
    });

    // 新しい日付を上にする
    records.sort((a, b) =>
        b.date.localeCompare(a.date)
    );

    // まだ勉強していない場合
    if (records.length === 0) {
        container.innerHTML =
            '<p class="empty-msg">まだ学習記録がありません。</p>';
        return;
    }

    // 日付ごとに表示
    records.forEach(record => {

        const dateBox = document.createElement("div");
        dateBox.className = "learning-history-item";

        // 日付
        const dateTitle = document.createElement("h4");

        const dateParts = record.date.split("-");

        dateTitle.textContent =
            `${Number(dateParts[1])}月${Number(dateParts[2])}日`;

        dateBox.appendChild(dateTitle);

        // 科目
        Object.entries(record.subjects).forEach(
            ([subject, counts]) => {

                const row =
                    document.createElement("div");

                row.className =
                    "learning-history-subject";

                let text =
                    `${subject}　${counts.normal + counts.extra}コマ`;

                // 追加勉強がある場合
                if (counts.extra > 0) {
                    text += `（追加 ${counts.extra}コマ）`;
                }

                row.textContent = text;

                dateBox.appendChild(row);
            }
        );

        container.appendChild(dateBox);
        // その日の総勉強時間
const dailyMinutes = record.totalCount * 60;
const dailyHours = Math.floor(dailyMinutes / 60);
const dailyMinutesRest = dailyMinutes % 60;

const timeRow = document.createElement("div");
timeRow.className = "learning-history-total";

if (dailyMinutesRest === 0) {
    timeRow.textContent = `勉強時間：${dailyHours}時間`;
} else {
    timeRow.textContent =
        `勉強時間：${dailyHours}時間${dailyMinutesRest}分`;
}

dateBox.appendChild(timeRow);
    });
}
function showMyPage() {
	  document.getElementById("practice-page").style.display = "none";
    // 学習計画側を全部隠す
    document.querySelector(".main-title").style.display = "none";
    document.querySelector(".nav-menu").style.display = "none";
    document.getElementById("hero").style.display = "none";
    document.querySelector(".guide-toggle-btn").style.display = "none";
    document.getElementById("guide-box").style.display = "none";
    document.getElementById("plan-type-section").style.display = "none";
    document.getElementById("form-section").style.display = "none";
   document.getElementById("result-layout").style.setProperty("display", "none", "important");

    // マイページだけ表示
    document.getElementById("mypage").style.display = "block";

    // マイページの内容を更新
    renderMyPage();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function showStudyPage() {
	// 練習問題を隠す
    document.getElementById("practice-page").style.display = "none";
	
    // マイページを隠す
    document.getElementById("mypage").style.display = "none";

    // 学習計画側を表示
    document.querySelector(".main-title").style.display = "block";
    document.querySelector(".nav-menu").style.display = "flex";
    document.getElementById("hero").style.display = "block";
    document.querySelector(".guide-toggle-btn").style.display = "block";
    document.getElementById("plan-type-section").style.display = "block";
    document.getElementById("form-section").style.display = "block";

    // 計画がある場合だけ結果を表示
if (daysArray.length > 0) {
    document.getElementById("result-layout")
        .style.setProperty("display", "grid", "important");
}

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ==========================================
// 練習問題
// ==========================================
let selectedSubject = "";
let selectedQuestionCount = 0;


// 教科を選択
function selectSubject(subject) {

    selectedSubject = subject;

    updatePracticeSetting();
}


// 問題数を選択
function selectQuestionCount(count) {

    selectedQuestionCount = count;

    updatePracticeSetting();
}


// 選択状態を更新
function updatePracticeSetting() {

    const status =
        document.getElementById("practice-setting-status");

    const startButton =
        document.getElementById("practice-start-btn");


    if (selectedSubject && selectedQuestionCount) {

        status.textContent =
            selectedSubject + "・" +
            selectedQuestionCount + "問";

        startButton.disabled = false;

    } else if (selectedSubject) {

        status.textContent =
            selectedSubject +
            "を選択中。問題数を選択してください";

    } else if (selectedQuestionCount) {

        status.textContent =
            "問題数 " +
            selectedQuestionCount +
            "問を選択中。教科を選択してください";

    } else {

        status.textContent =
            "教科と問題数を選択してください";
    }
}



// 練習問題を開始
function startSelectedPractice() {

    if (!selectedSubject || !selectedQuestionCount) {
        return;
    }

    const questionData = practiceQuestionData[selectedSubject];

    if (!questionData || questionData.length === 0) {
        alert(`${selectedSubject}の問題はまだ準備中です！`);
        return;
    }

    currentPracticeQuestions = questionData;

    document.getElementById("practice-setting").style.display = "none";
    document.getElementById("practice-question-area").style.display = "block";

    startPractice();
}
// 練習問題データ

const practiceQuestions = [ 
    {
        question: "国王を処刑して専制君主制を廃し、共和制を打ち立てた革命は何というか？",
        answer: "ピューリタン革命",
        choices: [
            "ピューリタン革命",
            "名誉革命",
            "七月革命",
            "二月革命"
        ]
    },

    {
        question: "1688～89年にイギリスで起こった革命を何という？",
        answer: "名誉革命",
        choices: [
            "ピューリタン革命",
            "名誉革命",
            "フランス革命",
            "産業革命"
        ]
    },

    {
        question: "名誉革命の際、議会が制定したものは？",
        answer: "権利の章典",
        choices: [
            "人権宣言",
            "独立宣言",
            "権利の章典",
            "合衆国憲法"
        ],

        // 先生指定の必須問題
        required: true
    },

    {
        question: "権利の章典によって確立した政治体制は？",
        answer: "立憲君主政",
        choices: [
            "共和政",
            "絶対王政",
            "立憲君主政",
            "帝政"
        ]
    },

    {
        question: "イギリスが北アメリカ東海岸に建設した植民地の名前は？",
        answer: "13植民地",
        choices: [
            "13植民地",
            "西インド植民地",
            "フランス植民地",
            "ニューイングランド共和国"
        ]
    },

    {
        question: "フランスとイギリスが植民地をめぐって争った戦争を何という？",
        answer: "七年戦争",
        choices: [
            "百年戦争",
            "七年戦争",
            "普仏戦争",
            "三十年戦争"
        ]
    },

    {
        question: "1773年、イギリス議会が制定した茶法に反対して起こった事件は？",
        answer: "ボストン茶会事件",
        choices: [
            "ボストン虐殺事件",
            "ボストン茶会事件",
            "ワシントン事件",
            "独立事件"
        ]
    },

    {
        question: "アメリカ独立戦争で、1776年に発表された文書は？",
        answer: "独立宣言",
        choices: [
            "人権宣言",
            "独立宣言",
            "権利の章典",
            "合衆国憲法"
        ]
    },

    {
        question: "アメリカ独立宣言の起草の中心となった人物は？",
        answer: "ジェファソン",
        choices: [
            "ワシントン",
            "ジェファソン",
            "ロック",
            "モンテスキュー"
        ]
    },

    {
        question: "1787年に制定されたアメリカ合衆国の憲法は？",
        answer: "合衆国憲法",
        choices: [
            "独立宣言",
            "合衆国憲法",
            "人権宣言",
            "権利の章典"
        ]
    },

    {
        question: "アメリカの初代大統領は？",
        answer: "ワシントン",
        choices: [
            "ジェファソン",
            "ワシントン",
            "リンカン",
            "フランクリン"
        ]
    },

    {
        question: "立法、司法、行政の3つの権力を分けるための制度を何という？",
        answer: "三権分立制",
        choices: [
            "議院内閣制",
            "三権分立制",
            "直接民主制",
            "連邦制"
        ]
    },

    {
        question: "17～18世紀にヨーロッパで広まった新しい社会思想を何という？",
        answer: "啓蒙思想",
        choices: [
            "社会主義",
            "啓蒙思想",
            "ナショナリズム",
            "ロマン主義"
        ]
    },

    {
        question: "社会契約説に基づき、市民は政府に対する抵抗権をもつと主張した思想家は？",
        answer: "ロック",
        choices: [
            "ルソー",
            "モンテスキュー",
            "ロック",
            "ナポレオン・ボナパルト"
        ]
    },

    {
        question: "権力の集中を防ぐため、三権分立を説いた思想家は？",
        answer: "モンテスキュー",
        choices: [
            "ロック",
            "ルソー",
            "モンテスキュー",
            "ジェファソン"
        ]
    },

    {
        question: "人民主権と社会契約に基づく直接民主政を説いた思想家は？",
        answer: "ルソー",
        choices: [
            "ロック",
            "ルソー",
            "モンテスキュー",
            "ワシントン"
        ]
    },

    {
        question: "フランス革命前の身分制社会で、特権をもっていた第一身分は？",
        answer: "聖職者",
        choices: [
            "平民",
            "貴族",
            "聖職者",
            "商工業者"
        ]
    },

    {
        question: "フランス革命前の第二身分は？",
        answer: "貴族",
        choices: [
            "聖職者",
            "貴族",
            "平民",
            "労働者"
        ]
    },

    {
        question: "第三身分に含まれていたのはどのような人々？",
        answer: "平民",
        choices: [
            "聖職者",
            "貴族",
            "平民",
            "国王"
        ]
    },

    {
        question: "第三身分の議員を中心に結成された議会は？",
        answer: "国民議会",
        choices: [
            "立法議会",
            "国民公会",
            "国民議会",
            "フランクフルト国民議会"
        ]
    },

    {
        question: "1789年、民衆が襲撃したフランス革命開始の象徴となった場所は？",
        answer: "バスティーユ監獄",
        choices: [
            "ベルサイユ宮殿",
            "バスティーユ監獄",
            "ルーブル宮殿",
            "国会議事堂"
        ]
    },

    {
        question: "1789年に採択された、人間の平等、国民主権をうたう文書は？",
        answer: "人権宣言",
        choices: [
            "独立宣言",
            "権利の章典",
            "人権宣言",
            "合衆国憲法"
        ]
    },

    {
        question: "1791年に成立した、制限選挙による議会は？",
        answer: "立法議会",
        choices: [
            "国民議会",
            "立法議会",
            "国民公会",
            "総裁政府"
        ]
    },

    {
        question: "1792年、男子普通選挙によって成立した議会は？",
        answer: "国民公会",
        choices: [
            "国民議会",
            "立法議会",
            "国民公会",
            "総裁政府"
        ]
    },

    {
        question: "国民公会成立後、宣言された政治体制は？",
        answer: "共和政",
        choices: [
            "立憲君主政",
            "共和政",
            "帝政",
            "絶対王政"
        ]
    },

    {
        question: "1793年、急進共和派の中心人物として恐怖政治を行った人物は？",
        answer: "ロベスピエール",
        choices: [
            "ナポレオン・ボナパルト",
            "ロベスピエール",
            "ルイ16世",
            "ルソー"
        ]
    },

    {
        question: "1795年、新憲法のもとで成立した政府は？",
        answer: "総裁政府",
        choices: [
            "国民政府",
            "総裁政府",
            "統領政府",
            "共和政府"
        ]
    },

    {
        question: "1799年、総裁政府を倒して統領政府をつくり、第一統領となった人物は？",
        answer: "ナポレオン・ボナパルト",
        choices: [
            "ロベスピエール",
            "ナポレオン・ボナパルト",
            "ルイ16世",
            "ルイ＝ナポレオン"
        ]
    },

    {
        question: "フランス革命を収束させた人物は？",
        answer: "ナポレオン・ボナパルト",
        choices: [
            "ロベスピエール",
            "ナポレオン・ボナパルト",
            "ルソー",
            "モンテスキュー"
        ]
    },

    {
        question: "ナポレオンが作った政体は？",
        answer: "統領政府",
        choices: [
            "総裁政府",
            "統領政府",
            "第二共和政",
            "第二帝政"
        ]
    },

    {
        question: "1806年にナポレオンが消滅させた国は？",
        answer: "神聖ローマ帝国",
        choices: [
            "神聖ローマ帝国",
            "オーストリア帝国",
            "ロシア帝国",
            "フランス王国"
        ]
    },

    {
        question: "1812年、ナポレオンが遠征して失敗した国は？",
        answer: "ロシア",
        choices: [
            "イギリス",
            "ロシア",
            "ドイツ",
            "イタリア"
        ]
    },

    {
        question: "ナポレオン失脚後、ヨーロッパ諸国の代表が集まって開いた会議は？",
        answer: "ウィーン会議",
        choices: [
            "パリ会議",
            "ウィーン会議",
            "ベルリン会議",
            "フランクフルト会議"
        ]
    },

    {
        question: "1830年7月にフランスで起こり、ウィーン体制を揺るがした革命を何という？",
        answer: "七月革命",
        choices: [
            "二月革命",
            "七月革命",
            "三月革命",
            "フランス革命"
        ]
    },

    {
        question: "19世紀前半、ヨーロッパで発展し、資本主義社会の形成を進めた革命を何という？",
        answer: "産業革命",
        choices: [
            "フランス革命",
            "産業革命",
            "七月革命",
            "二月革命"
        ]
    },

    {
        question: "七月王政のもとで成長した富裕な商工業者・金融業者と、市民や労働者との対立が深まった背景にあったものは何？",
        answer: "産業革命",
        choices: [
            "産業革命",
            "名誉革命",
            "宗教改革",
            "農業革命"
        ]
    },

    {
        question: "1848年、フランスで起こった革命を何という？",
        answer: "二月革命",
        choices: [
            "七月革命",
            "二月革命",
            "三月革命",
            "フランス革命"
        ]
    },

    {
        question: "二月革命をきっかけに、フランスでは何が成立した？",
        answer: "第二共和政",
        choices: [
            "第一共和政",
            "第二共和政",
            "第二帝政",
            "七月王政"
        ]
    },

    {
        question: "二月革命の結果、フランスの七月王政はどうなった？",
        answer: "崩壊した",
        choices: [
            "強化された",
            "崩壊した",
            "帝政になった",
            "イギリスに統合された"
        ]
    },

    {
        question: "1848年、フランスの二月革命の影響を受けてオーストリアで起こった革命を何という？",
        answer: "三月革命",
        choices: [
            "七月革命",
            "三月革命",
            "二月革命",
            "名誉革命"
        ]
    },

    {
        question: "ドイツ統一と憲法制定について議論するため、1848年に開催された議会は？",
        answer: "フランクフルト国民議会",
        choices: [
            "国民公会",
            "フランクフルト国民議会",
            "立法議会",
            "ウィーン議会"
        ]
    },

    {
        question: "1848年の革命では、自由主義とともに何の運動が高まった？",
        answer: "ナショナリズム",
        choices: [
            "帝国主義",
            "ナショナリズム",
            "絶対王政",
            "重商主義"
        ]
    },

    {
        question: "ナショナリズムとは、一つの民族が何をつくることを理想とする考え方？",
        answer: "国民国家",
        choices: [
            "植民地",
            "国民国家",
            "帝国",
            "王国"
        ]
    },

    {
        question: "ナショナリズムの高まりによって、オーストリアなどでは何の民族や少数集団への抑圧が問題となった？",
        answer: "少数民族",
        choices: [
            "多数民族",
            "少数民族",
            "貴族",
            "聖職者"
        ]
    },

    {
        question: "1848年革命では、労働運動や社会主義運動が強まったことで、どのような階層と対立した？",
        answer: "資本家",
        choices: [
            "貴族",
            "聖職者",
            "資本家",
            "農民"
        ]
    },

    {
        question: "第二共和政の大統領選挙に当選し、1852年に皇帝となった人物は？",
        answer: "ルイ＝ナポレオン",
        choices: [
            "ナポレオン・ボナパルト",
            "ルイ16世",
            "ルイ＝ナポレオン",
            "ロベスピエール"
        ]
    },

    {
        question: "ナポレオン3世の第二帝政を崩壊させるきっかけとなった戦争は？",
        answer: "普仏戦争",
        choices: [
            "七年戦争",
            "普仏戦争",
            "クリミア戦争",
            "百年戦争"
        ]
    }
];

const englishQuestions = [
{
type:"選択式",
level:"★☆☆",
question:"次の文の Playing basketball の用法として正しいものはどれですか。Playing basketball is fun.",
choices:[
"主語",
"補語",
"目的語",
"前置詞の目的語"
],
answer:"主語",
explanation:"Playing basketball は「バスケットボールをすること」という意味で、文の主語になっています。"
},
{
type:"選択式",
level:"★☆☆",
question:"次の文の watching movies の用法として正しいものはどれですか。My favorite pastime is watching movies.",
choices:[
"主語",
"補語",
"目的語",
"形容詞"
],
answer:"補語",
explanation:"watching movies は主語 My favorite pastime の内容を説明する補語です。"
},
{
type:"選択式",
level:"★☆☆",
question:"次の文の listening to music の用法として正しいものはどれですか。I like listening to music.",
choices:[
"主語",
"補語",
"目的語",
"副詞"
],
answer:"目的語",
explanation:"listening to music は動詞 like の目的語になっています。"
},
{
type:"選択式",
level:"★☆☆",
question:"次の文の coming today の働きとして正しいものはどれですか。Thank you for coming today.",
choices:[
"主語",
"補語",
"前置詞forの目的語",
"動詞の原形"
],
answer:"前置詞forの目的語",
explanation:"前置詞 for の後ろには名詞相当語句が必要なので、動名詞 coming が置かれています。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして最も適切なものはどれですか。I don't like □□□ going out at night.",
choices:[
"him",
"he",
"his",
"himself"
],
answer:"him",
explanation:"動名詞の意味上の主語を代名詞で表す場合、目的格または所有格を使えます。この文では him going も可能です。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして最も適切なものはどれですか。He is anxious about □□□ staying home alone.",
choices:[
"Lucy",
"Lucy's",
"Lucy is",
"Lucys"
],
answer:"Lucy's",
explanation:"動名詞 staying の意味上の主語を名詞で表す場合、所有格 Lucy's を使います。"
},
{
type:"選択式",
level:"★★☆",
question:"「彼が夜に外出することが好きではない」という意味に最も近い英文はどれですか。",
choices:[
"I don't like him going out at night.",
"I don't like he going out at night.",
"I don't like his go out at night.",
"I don't like him to going out at night."
],
answer:"I don't like him going out at night.",
explanation:"動名詞の意味上の主語を目的格 him で表しています。"
},
{
type:"選択式",
level:"★☆☆",
question:"動名詞を否定するときの正しい形はどれですか。",
choices:[
"not＋動名詞",
"動名詞＋not",
"don't＋動名詞",
"no＋動名詞"
],
answer:"not＋動名詞",
explanation:"動名詞の否定は not doing の形にします。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。I'm sorry for □□□ sooner.",
choices:[
"not writing",
"not to write",
"don't writing",
"no writing"
],
answer:"not writing",
explanation:"動名詞の否定形は not＋doing です。for は前置詞なので、その後ろには動名詞が続きます。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の being treated はどのような形ですか。My little sister is tired of being treated like a child.",
choices:[
"動名詞の受動態",
"不定詞の受動態",
"現在分詞",
"過去分詞だけの形"
],
answer:"動名詞の受動態",
explanation:"being＋過去分詞で動名詞の受動態「～されること」を表します。"
},
{
type:"選択式",
level:"★★★",
question:"次の英文の意味として正しいものはどれですか。She is proud of having been a nurse.",
choices:[
"彼女は看護師であることを誇りに思っている。",
"彼女は看護師だったことを誇りに思っている。",
"彼女は看護師になることを誇りに思っている。",
"彼女は看護師になりたくないと思っている。"
],
answer:"彼女は看護師だったことを誇りに思っている。",
explanation:"having＋過去分詞は完了形の動名詞で、主節の時点より前のことを表します。"
},
{
type:"選択式",
level:"★★★",
question:"次の英文の意味として正しいものはどれですか。She was proud of having been a nurse.",
choices:[
"彼女は看護師であることを誇りに思っている。",
"彼女は看護師だったことを誇りに思っていた。",
"彼女は看護師になることを誇りに思っている。",
"彼女は看護師ではなかったことを誇りに思っていた。"
],
answer:"彼女は看護師だったことを誇りに思っていた。",
explanation:"was proud が過去形なので「誇りに思っていた」。having been a nurse はそれより前の経験を表します。"
},
{
type:"選択式",
level:"★☆☆",
question:"次の動詞のうち、動名詞を目的語にとるものはどれですか。",
choices:[
"enjoy",
"decide",
"promise",
"refuse"
],
answer:"enjoy",
explanation:"enjoyは動名詞を目的語にとる代表的な動詞です。enjoy doing の形で使います。"
},
{
type:"選択式",
level:"★★☆",
question:"次のうち、動名詞を目的語にとる動詞として正しい組み合わせはどれですか。",
choices:[
"finish・mind・avoid",
"decide・promise・refuse",
"want・hope・expect",
"agree・offer・fail"
],
answer:"finish・mind・avoid",
explanation:"finish doing、mind doing、avoid doing のように、これらは動名詞を目的語にとります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。We enjoyed □□□ cards.",
choices:[
"playing",
"to play",
"play",
"played"
],
answer:"playing",
explanation:"enjoyは動名詞を目的語にとるので、enjoy playing cards となります。"
},
{
type:"選択式",
level:"★★☆",
question:"次のうち、不定詞を目的語にとる動詞はどれですか。",
choices:[
"decide",
"avoid",
"finish",
"mind"
],
answer:"decide",
explanation:"decide to do で「～することを決める」という意味になります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。I hope □□□ you again.",
choices:[
"to see",
"seeing",
"see",
"to seeing"
],
answer:"to see",
explanation:"hopeは不定詞を目的語にとり、hope to do の形になります。"
},
{
type:"選択式",
level:"★☆☆",
question:"次の文の意味として正しいものはどれですか。I like playing soccer.",
choices:[
"私はサッカーをすることが好きです。",
"私はサッカーをし終えました。",
"私はサッカーをすることを決めました。",
"私はサッカーをすることを忘れました。"
],
answer:"私はサッカーをすることが好きです。",
explanation:"likeは動名詞・不定詞のどちらも目的語にとることができます。"
},
{
type:"選択式",
level:"★★★",
question:"次の文の意味として正しいものはどれですか。I'll never forget visiting Australia this summer.",
choices:[
"この夏、オーストラリアを訪れることを決して忘れない。",
"この夏、オーストラリアを訪れたことを決して忘れない。",
"この夏、オーストラリアを訪れることを忘れてしまう。",
"オーストラリアを訪れることを決めた。"
],
answer:"この夏、オーストラリアを訪れたことを決して忘れない。",
explanation:"forget doing は「～したことを忘れる」という意味です。ここでは訪れた経験を忘れないという意味です。"
},
{
type:"選択式",
level:"★★★",
question:"次の文の意味として正しいものはどれですか。I forgot to take my medicine this morning.",
choices:[
"今朝、薬を飲んだことを忘れた。",
"今朝、薬を飲むのを忘れた。",
"今朝、薬を飲んでみた。",
"今朝、薬を飲むことを後悔した。"
],
answer:"今朝、薬を飲むのを忘れた。",
explanation:"forget to do は「～することを忘れる」という意味です。"
},
{
type:"選択式",
level:"★★★",
question:"remember doing と remember to do の違いとして正しいものはどれですか。",
choices:[
"doingは「したことを覚えている」、to doは「忘れずに～する」",
"doingは「～することを忘れる」、to doは「したことを覚えている」",
"どちらも全く同じ意味",
"doingは「～しようとする」、to doは「～したことを後悔する」"
],
answer:"doingは「したことを覚えている」、to doは「忘れずに～する」",
explanation:"remember doingは過去の経験を覚えていること、remember to doはこれからするべきことを忘れないことを表します。"
},
{
type:"選択式",
level:"★★★",
question:"try doing と try to do の意味の違いとして正しいものはどれですか。",
choices:[
"doingは「試しに～してみる」、to doは「～しようとする」",
"doingは「～しようとする」、to doは「試しに～してみる」",
"どちらも「～したことを覚えている」",
"どちらも「～することを後悔する」"
],
answer:"doingは「試しに～してみる」、to doは「～しようとする」",
explanation:"try doingは方法として試してみること、try to doは努力して～しようとすることを表します。"
},
{
type:"記述式",
level:"★☆☆",
question:"「バスケットボールをすることは楽しい。」という意味になるように英文を書きなさい。",
answer:"Playing basketball is fun.",
explanation:"動名詞 Playing basketball を主語にします。"
},
{
type:"記述式",
level:"★☆☆",
question:"「私は音楽を聴くことが好きです。」という意味になるように英文を書きなさい。",
answer:"I like listening to music.",
explanation:"likeの目的語として動名詞 listening to music を使います。"
},
{
type:"記述式",
level:"★★☆",
question:"「もっと早く手紙を書かなくてすみません。」という意味になるように英文を書きなさい。",
answer:"I'm sorry for not writing sooner.",
explanation:"forは前置詞なので、その後ろには動名詞を置きます。否定は not writing です。"
},
{
type:"記述式",
level:"★★☆",
question:"「私たちはトランプをして楽しんだ。」という意味になるように英文を書きなさい。",
answer:"We enjoyed playing cards.",
explanation:"enjoyは動名詞を目的語にとるため、enjoyed playing cards となります。"
},
{
type:"記述式",
level:"★★☆",
question:"「あなたにまた会いたい。」という意味になるように英文を書きなさい。",
answer:"I hope to see you again.",
explanation:"hopeは不定詞を目的語にとる動詞なので hope to do の形にします。"
},
{
type:"記述式",
level:"★★★",
question:"「彼女は看護師だったことを誇りに思っている。」という意味になるように英文を書きなさい。",
answer:"She is proud of having been a nurse.",
explanation:"主節より前の「看護師だった」という経験なので、完了形の動名詞 having been を使います。"
},
{
type:"記述式",
level:"★★★",
question:"「今朝、私は薬を飲むのを忘れた。」という意味になるように英文を書きなさい。",
answer:"I forgot to take my medicine this morning.",
explanation:"forget to do は「～するのを忘れる」という意味です。"
},
{
type:"記述式",
level:"★★★",
question:"「この夏、オーストラリアを訪れたことを決して忘れない。」という意味になるように英文を書きなさい。",
answer:"I'll never forget visiting Australia this summer.",
explanation:"forget doing は「～したことを忘れる」という意味なので、visitingを使います。"
},
{
type:"記述式",
level:"★★★",
question:"「試しにその本を読んでみた。」という意味になるように、tryを使って英文を書きなさい。",
answer:"I tried reading the book.",
explanation:"try doing は「試しに～してみる」という意味です。"
},
{
type:"記述式",
level:"★★★",
question:"「3時に彼に会うことを忘れずに覚えておかなければならない。」という意味になるように、rememberを使って英文を書きなさい。",
answer:"I must remember to meet him at three.",
explanation:"remember to do は「忘れずに～する」という意味です。"
},
{
type:"選択式",
level:"★☆☆",
question:"次の文の to get enough sleep の用法として正しいものはどれですか。It's important to get enough sleep.",
choices:[
"名詞的用法",
"形容詞的用法",
"副詞的用法",
"不定詞の受動態"
],
answer:"名詞的用法",
explanation:"to get enough sleep は「十分な睡眠をとること」という意味で、文の内容を表す名詞的用法です。"
},
{
type:"選択式",
level:"★☆☆",
question:"次の文の to be a singer の働きとして正しいものはどれですか。Her dream is to be a singer.",
choices:[
"主語",
"補語",
"目的語",
"副詞"
],
answer:"補語",
explanation:"to be a singer は Her dream の内容を説明する補語になっています。"
},
{
type:"選択式",
level:"★☆☆",
question:"次の文の to go to university の用法として正しいものはどれですか。I hope to go to university.",
choices:[
"名詞的用法",
"形容詞的用法",
"副詞的用法",
"受動態"
],
answer:"名詞的用法",
explanation:"to go to university は hope の目的語となり、「大学に行くことを希望する」という意味を表しています。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の to help him の用法として正しいものはどれですか。Luckily, he had friends to help him.",
choices:[
"friendsを修飾する形容詞的用法",
"hadを修飾する副詞的用法",
"heの内容を表す名詞的用法",
"luckilyを修飾する副詞的用法"
],
answer:"friendsを修飾する形容詞的用法",
explanation:"to help him は「彼を助けてくれる」という意味で、直前の friends を修飾しています。"
},
{
type:"選択式",
level:"★★☆",
question:"something to write with の意味として最も適切なものはどれですか。",
choices:[
"何か書くもの",
"何か読むもの",
"何か食べるもの",
"何か聞くもの"
],
answer:"何か書くもの",
explanation:"something to write with は「何かを書くために使うもの」という意味です。withを忘れないことが重要です。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の to catch the 6:30 train の用法として正しいものはどれですか。I got up early to catch the 6:30 train.",
choices:[
"目的を表す副詞的用法",
"名詞的用法",
"形容詞的用法",
"補語としての用法"
],
answer:"目的を表す副詞的用法",
explanation:"to catch the 6:30 train は「6時30分の電車に乗るために」という目的を表しています。"
},
{
type:"選択式",
level:"★☆☆",
question:"次の文の空所に入るものとして正しいものはどれですか。I'm glad □□□ you.",
choices:[
"to see",
"see to",
"seeing",
"to seeing"
],
answer:"to see",
explanation:"glad to do で「～してうれしい」という意味になります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。He is smart □□□ solve the puzzle.",
choices:[
"enough to",
"to enough",
"enough for",
"too enough"
],
answer:"enough to",
explanation:"形容詞＋enough＋to do で「～するほど十分に…だ」という意味になります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。We arrived early □□□ □□□ get good seats.",
choices:[
"in order to",
"so that to",
"enough to",
"too to"
],
answer:"in order to",
explanation:"in order to do は「～するために」という目的を表します。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。I don't know □□□ to do.",
choices:[
"what",
"where",
"who",
"why"
],
answer:"what",
explanation:"what to do で「何をすべきか」という意味になります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。I want you □□□ come to tomorrow's party.",
choices:[
"to",
"for",
"of",
"at"
],
answer:"to",
explanation:"want＋O＋to do で「Oに～してほしい」という意味になります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。My parents won't allow me □□□ study abroad.",
choices:[
"to",
"for",
"of",
"at"
],
answer:"to",
explanation:"allow＋O＋to do で「Oが～するのを許す」という意味になります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。He asked me □□□ save a seat for him.",
choices:[
"to",
"for",
"of",
"at"
],
answer:"to",
explanation:"ask＋O＋to do で「Oに～するよう頼む」という意味になります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。My mother made me □□□ my room.",
choices:[
"clean",
"to clean",
"cleaning",
"cleaned"
],
answer:"clean",
explanation:"make＋O＋原形不定詞で「Oに～させる」という意味になります。makeの後ではtoを付けません。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。My father let me □□□ to the movies.",
choices:[
"go",
"to go",
"going",
"went"
],
answer:"go",
explanation:"let＋O＋原形不定詞で「Oが～するのを許す」という意味になります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。I had the porter □□□ my baggage.",
choices:[
"carry",
"to carry",
"carrying",
"carried"
],
answer:"carry",
explanation:"have＋O＋原形不定詞で「Oに～してもらう」という意味になります。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。I saw the man □□□ out of the car.",
choices:[
"get",
"to get",
"getting to",
"got"
],
answer:"get",
explanation:"see＋O＋原形不定詞で「Oが～するのを見る」という意味になります。"
},
{
type:"選択式",
level:"★★★",
question:"次の英文の意味として正しいものはどれですか。He seems to have been ill.",
choices:[
"彼は病気だったと思われる。",
"彼は病気になると思われる。",
"彼は病気である最中だと思われる。",
"彼は病気になるために努力した。"
],
answer:"彼は病気だったと思われる。",
explanation:"to have＋過去分詞は完了形で、seems より前の出来事・状態を表します。"
},
{
type:"選択式",
level:"★★☆",
question:"次の文の空所に入るものとして正しいものはどれですか。She told me □□□ to be late.",
choices:[
"not",
"no",
"don't",
"didn't"
],
answer:"not",
explanation:"不定詞を否定するときは not to do の形にします。"
},
{
type:"選択式",
level:"★★★",
question:"次の文の空所に入るものとして正しいものはどれですか。She seems □□□ □□□ enjoying her holiday.",
choices:[
"to be",
"to have",
"to",
"being to"
],
answer:"to be",
explanation:"to be＋doing で不定詞の進行形となり、「～しているようだ」という意味になります。"
},
{
type:"選択式",
level:"★★★",
question:"次の文の空所に入るものとして正しいものはどれですか。Children need □□□ □□□ accompanied by an adult.",
choices:[
"to be",
"to have",
"to",
"being to"
],
answer:"to be",
explanation:"to be＋過去分詞で不定詞の受動態を表します。Children need to be accompanied で「子どもたちは大人に同行してもらう必要がある」という意味です。"
},
{
type:"記述式",
level:"★☆☆",
question:"「十分な睡眠をとることは大切です。」という意味になるように、Itから始めて英文を書きなさい。",
answer:"It's important to get enough sleep.",
explanation:"It is ～ to do の形式主語構文を使います。"
},
{
type:"記述式",
level:"★☆☆",
question:"「私は大学に行くことを希望しています。」という意味になるように、I hopeから始めて英文を書きなさい。",
answer:"I hope to go to university.",
explanation:"hopeの目的語としてto go to universityを置きます。"
},
{
type:"記述式",
level:"★★☆",
question:"次の英文を日本語に訳しなさい。I found it easy to book a hotel online.",
answer:"私はインターネットでホテルを予約することが簡単だとわかった。",
explanation:"find＋it＋形容詞＋to do の構文です。itは形式目的語で、to book a hotel onlineが内容を表します。"
},
{
type:"記述式",
level:"★★☆",
question:"「今日はするべきことがたくさんあります。」という意味になるように英文を書きなさい。",
answer:"I have a lot of things to do today.",
explanation:"things to do は「するべきこと」という意味で、to doがthingsを修飾しています。"
},
{
type:"記述式",
level:"★★☆",
question:"「私はあなたに明日のパーティーに来てほしい。」という意味になるように英文を書きなさい。",
answer:"I want you to come to tomorrow's party.",
explanation:"want＋O＋to do で「Oに～してほしい」という意味を表します。"
},
{
type:"記述式",
level:"★★☆",
question:"「母は私に部屋を掃除させた。」という意味になるように英文を書きなさい。",
answer:"My mother made me clean my room.",
explanation:"make＋O＋原形不定詞で「Oに～させる」を表します。"
},
{
type:"記述式",
level:"★★★",
question:"「彼は病気だったと思われる。」という意味になるように英文を書きなさい。",
answer:"He seems to have been ill.",
explanation:"to have been ill は完了形の不定詞で、seemsより前の「病気だった」という状態を表します。"
},
{
type:"記述式",
level:"★★☆",
question:"「彼女は私に遅れないように言った。」という意味になるように、次の英文を書き換えなさい。She told me to be late.",
answer:"She told me not to be late.",
explanation:"不定詞を否定するときは not to do の形にします。"
},
{
type:"記述式",
level:"★★★",
question:"「彼女は休暇を楽しんでいるようだ。」という意味になるように英文を書きなさい。",
answer:"She seems to be enjoying her holiday.",
explanation:"seem＋to be＋doing で「～しているようだ」という進行中の状態を表します。"
},
{
type:"記述式",
level:"★★☆",
question:"「私は何をすべきかわからない。」という意味になるように英文を書きなさい。",
answer:"I don't know what to do.",
explanation:"疑問詞＋to do の形で「何をすべきか」という意味を表します。"
}



];
const mathAQuestions = [
    {
        type: "選択式",
        level: "★☆☆",
        question: "1個のサイコロを1回投げるとき、3の倍数の目が出る確率を求めなさい。",
        choices: ["1/6", "1/3", "1/2", "2/3"],
        answer: "1/3",
        explanation: "3の倍数の目は3、6の2通り。全体は6通りなので、2/6=1/3。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "1枚の硬貨を3回投げるとき、表がちょうど2回出る確率を求めなさい。",
        choices: ["1/4", "3/8", "1/2", "5/8"],
        answer: "3/8",
        explanation: "表・裏の出方は2^3=8通り。表がちょうど2回出る場合は3C2=3通りなので、3/8。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "1個のサイコロを2回投げるとき、2回とも奇数の目が出る確率を求めなさい。",
        choices: ["1/6", "1/4", "1/3", "1/2"],
        answer: "1/4",
        explanation: "奇数は1、3、5の3通り。1回で奇数が出る確率は3/6=1/2。2回とも奇数なので、1/2×1/2=1/4。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "1から10までの数字が1枚ずつ書かれた10枚のカードがある。この中から1枚を無作為に選ぶとき、選んだカードの数字が3の倍数または偶数である確率を求めなさい。",
        choices: ["1/2", "3/5", "7/10", "4/5"],
        answer: "7/10",
        explanation: "3の倍数は3、6、9の3個。偶数は2、4、6、8、10の5個。両方に含まれる6を重複して数えないので、3+5－1=7個。よって7/10。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "当たりが3本、はずれが7本入っている箱から、同時に2本のくじを無作為に取り出すとき、2本とも当たりである確率を求めなさい。",
        choices: ["1/10", "1/15", "1/20", "2/15"],
        answer: "1/15",
        explanation: "全部で10本。10本から2本を選ぶ方法は10C2=45通り。当たり2本の選び方は3C2=3通り。よって3/45=1/15。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "2個のサイコロを同時に1回投げるとき、2個とも同じ目が出る確率を求めなさい。",
        choices: ["1/12", "1/6", "1/4", "1/3"],
        answer: "1/6",
        explanation: "出方は6×6=36通り。同じ目になるのは6通りなので、6/36=1/6。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "2個のサイコロを同時に1回投げるとき、2個の目の和が8になる確率を求めなさい。",
        choices: ["1/9", "5/36", "1/6", "7/36"],
        answer: "5/36",
        explanation: "全体は36通り。和が8になるのは(2,6),(3,5),(4,4),(5,3),(6,2)の5通り。よって5/36。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "A、Bを含む6人が、くじ引きで順番を決めて横一列に並ぶとき、Aが1番目、Bが6番目になる確率を求めなさい。",
        choices: ["1/15", "1/20", "1/30", "1/60"],
        answer: "1/30",
        explanation: "6人の並び方は6!通り。Aが1番目、Bが6番目なら残り4人は4!通り。よって4!/6!=1/30。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "A、Bを含む6人が、くじ引きで順番を決めて横一列に並ぶとき、AとBが隣り合う確率を求めなさい。",
        choices: ["1/6", "1/3", "1/2", "2/3"],
        answer: "1/3",
        explanation: "AとBを1つのかたまりと考えると5!通り。かたまりの中はAB、BAの2通り。5!×2=240通り。240/720=1/3。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "A、Bを含む6人が、くじ引きで順番を決めて横一列に並ぶとき、AがBより前に並ぶ確率を求めなさい。",
        choices: ["1/6", "1/3", "1/2", "2/3"],
        answer: "1/2",
        explanation: "AがBより前の場合と、BがAより前の場合の2通りがあり、どちらも同じ確率なので1/2。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "袋の中に赤玉3個、白玉4個が入っている。この袋から玉を3個同時に取り出すとき、赤玉が1個、白玉が2個出る確率を求めなさい。",
        choices: ["3/7", "18/35", "2/5", "4/7"],
        answer: "18/35",
        explanation: "全体は7C3通り。赤玉から1個は3C1、白玉から2個は4C2。したがって3C1×4C2/7C3=18/35。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "袋の中に赤玉4個、白玉5個が入っている。この袋から玉を3個同時に取り出すとき、少なくとも1個は赤玉が出る確率を求めなさい。",
        choices: ["5/42", "1/2", "37/42", "4/5"],
        answer: "37/42",
        explanation: "余事象を利用する。赤玉が1個も出ない、つまり3個とも白玉となる確率は5C3/9C3=5/42。よって1－5/42=37/42。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "大人6人、子供4人の合計10人の中から、抽選で5人を選ぶとき、大人3人、子供2人が選ばれる確率を求めなさい。",
        choices: ["2/7", "10/21", "1/2", "4/7"],
        answer: "10/21",
        explanation: "全体は10C5。大人3人・子供2人は6C3×4C2通り。よって120/252=10/21。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "大人6人、子供4人の合計10人の中から、抽選で4人を選ぶとき、大人が2人以上選ばれる確率を求めなさい。",
        choices: ["1/2", "5/7", "37/42", "6/7"],
        answer: "37/42",
        explanation: "大人2人・3人・4人の場合を考える。場合の数は90+80+15=185通り。全体は10C4=210通りなので185/210=37/42。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "袋の中に赤玉4個、白玉5個が入っている。この袋から玉を2個同時に取り出すとき、2個の玉が同じ色である確率を求めなさい。",
        choices: ["1/3", "4/9", "1/2", "5/9"],
        answer: "4/9",
        explanation: "全体は9C2=36通り。同じ色は赤2個または白2個で、4C2+5C2=16通り。よって16/36=4/9。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "1から100までの番号が1枚ずつ書かれた100枚の番号札がある。この中から1枚を無作為に選ぶとき、5の倍数でない番号札を引く確率を求めなさい。",
        choices: ["1/5", "2/5", "4/5", "9/10"],
        answer: "4/5",
        explanation: "5の倍数は20個。5の倍数でない番号は100－20=80個。よって80/100=4/5。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "袋の中に赤玉4個、白玉5個が入っている。この袋から玉を3個同時に取り出すとき、少なくとも1個が赤玉である確率を求めなさい。",
        choices: ["5/42", "1/2", "37/42", "8/9"],
        answer: "37/42",
        explanation: "余事象は3個とも白玉。確率は5C3/9C3=5/42。したがって1－5/42=37/42。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "1個のサイコロを3回投げるとき、少なくとも1回は6の目が出る確率を求めなさい。",
        choices: ["25/216", "91/216", "1/2", "125/216"],
        answer: "91/216",
        explanation: "余事象は3回とも6が出ないこと。その確率は(5/6)^3=125/216。よって1－125/216=91/216。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "1から50までの番号が1枚ずつ書かれた50枚の番号札がある。この中から3枚を同時に取り出すとき、少なくとも1枚が10の倍数の番号札である確率を求めなさい。",
        choices: ["1/4", "541/1960", "3/10", "5/14"],
        answer: "541/1960",
        explanation: "10の倍数は5枚、そうでない札は45枚。余事象より1－45C3/50C3=541/1960。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "2枚の硬貨と1個のサイコロを同時に1回投げるとき、2枚の硬貨がともに表で、かつサイコロが4以上の目になる確率を求めなさい。",
        choices: ["1/12", "1/8", "1/6", "1/4"],
        answer: "1/8",
        explanation: "2枚とも表は1/4。サイコロが4以上は3/6=1/2。したがって1/4×1/2=1/8。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "1個のサイコロを3回続けて投げるとき、3回とも偶数の目が出る確率を求めなさい。",
        choices: ["1/4", "1/6", "1/8", "1/12"],
        answer: "1/8",
        explanation: "偶数は2、4、6の3通りなので1回で偶数が出る確率は1/2。3回とも偶数なので(1/2)^3=1/8。"
    },
    {
        type: "選択式",
        level: "★☆☆",
        question: "1枚の硬貨を3回続けて投げるとき、1回目と2回目は表、3回目は裏が出る確率を求めなさい。",
        choices: ["1/4", "1/6", "1/8", "1/16"],
        answer: "1/8",
        explanation: "表、表、裏という1つの結果を求めるので、1/2×1/2×1/2=1/8。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "袋Aには赤玉3個、白玉2個、袋Bには赤玉2個、白玉4個が入っている。A、Bの袋からそれぞれ1個ずつ球を取り出すとき、取り出した2個の球が異なる色である確率を求めよ。",
        choices: ["2/5", "8/15", "1/2", "3/5"],
        answer: "8/15",
        explanation: "A赤・B白は3/5×2/3=2/5。A白・B赤は2/5×1/3=2/15。合わせて8/15。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "袋Aには赤玉4個、白玉3個、袋Bには赤玉3個、白玉2個が入っている。A、Bの袋からそれぞれ1個ずつ球を取り出し、Aの袋から取り出した球をBの袋に入れてから、Bの袋からもう1個球を取り出す。このとき、2回とも赤玉を取り出す確率を求めよ。",
        choices: ["4/21", "2/7", "8/21", "1/2"],
        answer: "8/21",
        explanation: "Aから赤玉を取り出す確率は4/7。その赤玉をBに入れるとBは赤4個・白2個なので、Bから赤玉を引く確率は4/6=2/3。よって8/21。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "表と裏が出る確率がそれぞれ1/2である硬貨を1枚、6回投げる。このとき、表がちょうど3回、裏が3回出る確率を求めよ。",
        choices: ["5/16", "3/8", "1/2", "15/32"],
        answer: "5/16",
        explanation: "表が出る3回を6回の中から選ぶので6C3=20通り。各結果の確率は(1/2)^6。よって20/64=5/16。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "1個のさいころを5回投げるとき、3の倍数の目がちょうど2回出る確率を求めよ。",
        choices: ["40/243", "80/243", "100/243", "120/243"],
        answer: "80/243",
        explanation: "3の倍数は3、6なので確率は1/3。それ以外は2/3。5回中ちょうど2回なので5C2(1/3)^2(2/3)^3=80/243。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "袋の中に赤玉4個、白玉3個が入っている。この袋から玉を1個取り出し、色を確認してから元の袋に戻すという操作を4回繰り返す。このとき、赤玉がちょうど3回出る確率を求めよ。",
        choices: ["256/2401", "512/2401", "768/2401", "1024/2401"],
        answer: "768/2401",
        explanation: "赤玉は4/7、白玉は3/7。4回中ちょうど3回赤玉なので4C3(4/7)^3(3/7)=768/2401。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "袋の中に、1から10までの番号が書かれた赤色のカード5枚と、11から15までの番号が書かれた白色のカード5枚が入っている。この袋からカードを1枚取り出す。取り出したカードが赤色であることが分かっているとき、その番号が奇数である条件付き確率を求めよ。",
        choices: ["1/3", "2/5", "3/5", "4/5"],
        answer: "3/5",
        explanation: "赤色であることが分かっているので赤色カード5枚だけを考える。奇数は1、3、5の3枚。よって3/5。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "箱の中に、1から8までの番号が書かれた青色の番号札8枚と、1から6までの番号が書かれた白色の番号札6枚が入っている。この箱から番号札を1枚引く。引いた番号札の番号が偶数であることが分かっているとき、その番号札が青色である条件付き確率を求めよ。",
        choices: ["3/7", "4/7", "1/2", "5/7"],
        answer: "4/7",
        explanation: "偶数は青色が2、4、6、8の4枚、白色が2、4、6の3枚。偶数は7枚なので4/7。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "箱の中に、1から6までの番号が書かれた赤色の番号札6枚と、7から12までの番号が書かれた白色の番号札6枚が入っている。この箱から番号札を1枚引く。引いた番号札の番号が3の倍数であることが分かっているとき、その番号札が白色である条件付き確率を求めよ。",
        choices: ["1/3", "1/2", "2/3", "3/4"],
        answer: "1/2",
        explanation: "3の倍数は赤色が3、6の2枚、白色が9、12の2枚。合計4枚中、白色は2枚なので1/2。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "当たりくじが3本、外れくじが7本、合わせて10本のくじがある。A、Bの2人がこの順に1本ずつくじを引く。ただし、引いたくじは元に戻さない。このとき、A、Bの2人とも当たる確率を求めよ。",
        choices: ["1/20", "1/15", "2/15", "1/10"],
        answer: "1/15",
        explanation: "Aが当たる確率は3/10。Aが当たった後は当たり2本、全体9本なのでBが当たる確率は2/9。よって3/10×2/9=1/15。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "当たりくじが4本、外れくじが8本、合わせて12本のくじがある。A、B、Cの3人がこの順に1本ずつくじを引く。ただし、引いたくじは元に戻さない。このとき、A、B、Cの3人のうち、ちょうど2人が当たる確率を求めよ。",
        choices: ["8/55", "12/55", "16/55", "3/11"],
        answer: "12/55",
        explanation: "ちょうど2人が当たる場合はA・B、A・C、B・Cの3通り。それぞれ4/55なので、合計12/55。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "当たりくじが5本、外れくじが7本、合わせて12本のくじがある。A、B、Cの3人がこの順に1本ずつくじを引く。ただし、引いたくじは元に戻さない。このとき、少なくとも1人が当たる確率を求めよ。",
        choices: ["7/44", "1/2", "37/44", "5/6"],
        answer: "37/44",
        explanation: "余事象は3人とも外れること。確率は7/12×6/11×5/10=7/44。よって1－7/44=37/44。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "1から8までの番号が書かれた8枚の番号札がある。この中から3枚を同時に取り出し、取り出した3枚の番号の最大の数が6以上である確率を求めよ。",
        choices: ["5/28", "1/2", "23/28", "25/28"],
        answer: "23/28",
        explanation: "全体は8C3=56通り。最大が5以下となるのは1～5から3枚を選ぶ10通り。余事象より1－10/56=23/28。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "1個のさいころを1回投げる。出た目が1、2のときは100円、3、4のときは200円、5、6のときは500円をもらえるゲームがある。このゲームでもらえる金額の期待値を求めよ。",
        choices: ["200/3円", "400/3円", "800/3円", "1000/3円"],
        answer: "800/3円",
        explanation: "100円、200円、500円がそれぞれ2/6の確率で得られる。期待値は100×2/6+200×2/6+500×2/6=800/3円。"
    },
    {
        type: "選択式",
        level: "★★☆",
        question: "表と裏が出る確率がそれぞれ1/2である硬貨を3枚同時に投げる。表が0枚のときは0円、1枚のときは100円、2枚のときは300円、3枚のときは600円をもらえるものとする。このとき、もらえる金額の期待値を求めよ。",
        choices: ["150円", "200円", "225円", "250円"],
        answer: "225円",
        explanation: "表0枚、1枚、2枚、3枚の確率はそれぞれ1/8、3/8、3/8、1/8。期待値は0×1/8+100×3/8+300×3/8+600×1/8=225円。"
    }
];
const mathIIIQuestions = [
    {
        type: "選択式",
        level: "★☆☆",
        question: "関数 \\( y=x\\sqrt{x} \\) の導関数として正しいものはどれですか。",
        choices: [
            "\\( y'=\\sqrt{x} \\)",
            "\\( y'=\\frac{3}{2}\\sqrt{x} \\)",
            "\\( y'=2\\sqrt{x} \\)",
            "\\( y'=3x \\)"
        ],
        answer: "\\( y'=\\frac{3}{2}\\sqrt{x} \\)",
        explanation: "\\(x\\sqrt{x}=x^{\\frac{3}{2}}\\) と変形すると、\\(y'=\\frac{3}{2}x^{\\frac{1}{2}}=\\frac{3}{2}\\sqrt{x}\\) となります。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "関数 \\( y=\\frac{x^2+x+1}{\\sqrt{x}} \\) の導関数として正しいものはどれですか。",
        choices: [
            "\\( y'=\\frac{1}{2}\\sqrt{x}+\\frac{1}{2\\sqrt{x}}-\\frac{1}{2x\\sqrt{x}} \\)",
            "\\( y'=\\frac{3}{2}\\sqrt{x}+\\frac{1}{2\\sqrt{x}}-\\frac{1}{2x\\sqrt{x}} \\)",
            "\\( y'=2\\sqrt{x}+\\frac{1}{\\sqrt{x}} \\)",
            "\\( y'=\\sqrt{x}+\\frac{1}{\\sqrt{x}}+\\frac{1}{x} \\)"
        ],
        answer: "\\( y'=\\frac{3}{2}\\sqrt{x}+\\frac{1}{2\\sqrt{x}}-\\frac{1}{2x\\sqrt{x}} \\)",
        explanation: "\\(y=x^{\\frac{3}{2}}+x^{\\frac{1}{2}}+x^{-\\frac{1}{2}}\\) と変形して、それぞれ微分します。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "関数 \\( y=\\frac{x^2}{x-1} \\) の導関数として正しいものはどれですか。",
        choices: [
            "\\( y'=\\frac{x(x-2)}{(x-1)^2} \\)",
            "\\( y'=\\frac{x^2}{(x-1)^2} \\)",
            "\\( y'=\\frac{2x-1}{x-1} \\)",
            "\\( y'=\\frac{x(x+2)}{(x-1)^2} \\)"
        ],
        answer: "\\( y'=\\frac{x(x-2)}{(x-1)^2} \\)",
        explanation: "商の微分法より、\\(y'=\\frac{2x(x-1)-x^2}{(x-1)^2}=\\frac{x(x-2)}{(x-1)^2}\\) です。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "\\(1+x+x^2+\\cdots+x^n\\) を \\(x\\) で微分した式として正しいものはどれですか。",
        choices: [
            "\\(1+2x+3x^2+\\cdots+nx^{n-1}\\)",
            "\\(x+2x^2+3x^3+\\cdots+nx^n\\)",
            "\\(1+x+x^2+\\cdots+x^{n-1}\\)",
            "\\(2+3x+4x^2+\\cdots+(n+1)x^n\\)"
        ],
        answer: "\\(1+2x+3x^2+\\cdots+nx^{n-1}\\)",
        explanation: "\\(\\frac{d}{dx}x^k=kx^{k-1}\\) を各項に適用します。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "関数 \\(y=e^x(\\sin x+\\cos x)\\) が満たす等式として正しいものはどれですか。",
        choices: [
            "\\(y''+2y'+2y=0\\)",
            "\\(y''-2y'+2y=0\\)",
            "\\(y''-y'+y=0\\)",
            "\\(y''+y'-2y=0\\)"
        ],
        answer: "\\(y''-2y'+2y=0\\)",
        explanation: "\\(y\\) を2回微分して整理すると、\\(y''-2y'+2y=0\\) が成り立ちます。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "楕円 \\(\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1\\) を微分したとき、\\(\\frac{dy}{dx}\\) として正しいものはどれですか。",
        choices: [
            "\\(\\frac{dy}{dx}=\\frac{b^2x}{a^2y}\\)",
            "\\(\\frac{dy}{dx}=-\\frac{b^2x}{a^2y}\\)",
            "\\(\\frac{dy}{dx}=-\\frac{a^2x}{b^2y}\\)",
            "\\(\\frac{dy}{dx}=-\\frac{xy}{a^2b^2}\\)"
        ],
        answer: "\\(\\frac{dy}{dx}=-\\frac{b^2x}{a^2y}\\)",
        explanation: "両辺を微分すると、\\(\\frac{2x}{a^2}+\\frac{2y}{b^2}\\frac{dy}{dx}=0\\) となります。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "\\(\\lim_{h\\to0}\\frac{f(a+h)-f(a-h)}{h}\\) の値として正しいものはどれですか。",
        choices: [
            "\\(f'(a)\\)",
            "\\(-f'(a)\\)",
            "\\(2f'(a)\\)",
            "\\(0\\)"
        ],
        answer: "\\(2f'(a)\\)",
        explanation: "式を2つの微分係数に分けると、それぞれ \\(f'(a)\\) になるため、合計は \\(2f'(a)\\) です。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "極限 \\(\\lim_{x\\to0}\\frac{\\log(1+x)}{x}\\) の値はどれですか。",
        choices: [
            "\\(0\\)",
            "\\(1\\)",
            "\\(e\\)",
            "\\(\\infty\\)"
        ],
        answer: "\\(1\\)",
        explanation: "微分係数の定義から、\\(\\lim_{x\\to0}\\frac{\\log(1+x)-\\log1}{x}=1\\) です。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "\\(\\lim_{n\\to\\infty}\\left(1+\\frac{1}{n}\\right)^{2n}\\) の値はどれですか。",
        choices: [
            "\\(e\\)",
            "\\(e^2\\)",
            "\\(2e\\)",
            "\\(\\frac{e}{2}\\)"
        ],
        answer: "\\(e^2\\)",
        explanation: "\\(\\left(1+\\frac1n\\right)^{2n}=\\left\\{\\left(1+\\frac1n\\right)^n\\right\\}^2\\) なので、極限は \\(e^2\\) です。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "関数 \\(y=\\frac{1-\\tan x}{1+\\tan x}\\) の導関数として正しいものはどれですか。",
        choices: [
            "\\(y'=-\\frac{2}{(1+\\tan x)^2}\\)",
            "\\(y'=-\\frac{2(1+\\tan^2x)}{(1+\\tan x)^2}\\)",
            "\\(y'=\\frac{2(1+\\tan^2x)}{(1+\\tan x)^2}\\)",
            "\\(y'=-\\frac{1}{1+\\tan x}\\)"
        ],
        answer: "\\(y'=-\\frac{2(1+\\tan^2x)}{(1+\\tan x)^2}\\)",
        explanation: "商の微分法と \\((\\tan x)'=1+\\tan^2x\\) を使います。"
    },

    {
        type: "選択式",
        level: "★★☆",
        question: "関数 \\(f(x)=\\sin x\\) の \\(n\\) 階導関数として正しいものはどれですか。",
        choices: [
            "\\(f^{(n)}(x)=\\sin\\left(x+\\frac{n\\pi}{2}\\right)\\)",
            "\\(f^{(n)}(x)=\\cos(x+n\\pi)\\)",
            "\\(f^{(n)}(x)=\\sin(nx)\\)",
            "\\(f^{(n)}(x)=\\cos\\left(x+\\frac{n\\pi}{2}\\right)\\)"
        ],
        answer: "\\(f^{(n)}(x)=\\sin\\left(x+\\frac{n\\pi}{2}\\right)\\)",
        explanation: "微分するたびに位相が \\(\\frac{\\pi}{2}\\) ずつ進み、4回で元に戻ります。"
    },

    {
        type: "選択式",
        level: "★★★",
        question: "方程式 \\(x^{\\frac23}+y^{\\frac23}=1\\) で定められる \\(y\\) について、\\(\\frac{dy}{dx}\\) として正しいものはどれですか。",
        choices: [
            "\\(\\frac{dy}{dx}=-\\left(\\frac{x}{y}\\right)^{\\frac13}\\)",
            "\\(\\frac{dy}{dx}=-\\left(\\frac{y}{x}\\right)^{\\frac13}\\)",
            "\\(\\frac{dy}{dx}=\\left(\\frac{y}{x}\\right)^{\\frac13}\\)",
            "\\(\\frac{dy}{dx}=-\\frac{y}{x}\\)"
        ],
        answer: "\\(\\frac{dy}{dx}=-\\left(\\frac{y}{x}\\right)^{\\frac13}\\)",
        explanation: "暗黙微分すると、\\(\\frac23x^{-\\frac13}+\\frac23y^{-\\frac13}\\frac{dy}{dx}=0\\) となり、整理すると求められます。"
    }
];
const practiceQuestionData = {
    "歴史": practiceQuestions,
    "英語（文法）": englishQuestions,
    "数学A": mathAQuestions,
    "数学III": mathIIIQuestions
};

let currentPracticeQuestions = [];

// 現在の問題
let currentPracticeQuestion = 0;

// 問題の順番
let practiceQuestionOrder = [];

// 正解数
let practiceCorrectCount = 0;


// ==========================================
// 練習問題ページを表示
// ==========================================

function showPracticePage() {

    // 学習計画側を全部隠す
    const mainTitle = document.querySelector(".main-title");
    const navMenu = document.querySelector(".nav-menu");
    const hero = document.getElementById("hero");
    const guideButton = document.querySelector(".guide-toggle-btn");
    const guideBox = document.getElementById("guide-box");
    const planType = document.getElementById("plan-type-section");
    const formSection = document.getElementById("form-section");
    const resultLayout = document.getElementById("result-layout");
    const mypage = document.getElementById("mypage");

    if (mainTitle) mainTitle.style.display = "none";
    if (navMenu) navMenu.style.display = "none";
    if (hero) hero.style.display = "none";
    if (guideButton) guideButton.style.display = "none";
    if (guideBox) guideBox.style.display = "none";
    if (planType) planType.style.display = "none";
    if (formSection) formSection.style.display = "none";
    if (resultLayout) resultLayout.style.display = "none";
    if (mypage) mypage.style.display = "none";


    // 練習問題ページを表示
    const practicePage =
        document.getElementById("practice-page");

    if (practicePage) {
        practicePage.style.display = "block";
    }


    // 練習問題の設定画面を表示
    const setting =
        document.getElementById("practice-setting");

    if (setting) {
        setting.style.display = "block";
    }


    // 問題画面は隠す
    const questionArea =
        document.getElementById("practice-question-area");

    if (questionArea) {
        questionArea.style.display = "none";
    }


    // ページ上部へ
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
    console.log(
    "練習問題ページ表示時 result-layout:",
    document.getElementById("result-layout").style.display
);

console.log(
    "練習問題ページ表示時 result-layout:",
    getComputedStyle(
        document.getElementById("result-layout")
    ).display
);
}

// ==========================================
// 練習問題開始
// ==========================================
let practiceWrongQuestions = [];

function startPractice() {
	document.getElementById(
    "practice-retry-label"
).style.display = "none";

isRetryingWrongQuestions = false;
    // 最初の問題からスタート
    currentPracticeQuestion = 0;

    // 正解数をリセット
    practiceCorrectCount = 0;

    // 間違えた問題をリセット
    practiceWrongQuestions = [];

    // 47問の中から問題番号を作る
 practiceQuestionOrder = currentPracticeQuestions.map((_, index) => index);

    // 問題をシャッフル
    shuffleArray(practiceQuestionOrder);

    // 選択した問題数だけ取り出す
    practiceQuestionOrder = practiceQuestionOrder.slice(
        0,
        selectedQuestionCount
    );

    // 問題を表示
    showPracticeQuestion();
}

// ==========================================
// 問題を表示
// ==========================================

function showPracticeQuestion() {

    console.log(
        "★現在の問題順：",
        practiceQuestionOrder,
        "現在位置：",
        currentPracticeQuestion
    );

    const questionIndex =
        practiceQuestionOrder[currentPracticeQuestion];

    const question =
        currentPracticeQuestions[questionIndex];

    // 問題番号
    document.getElementById(
        "practice-question-number"
    ).textContent =
        `第${currentPracticeQuestion + 1}問 / ${practiceQuestionOrder.length}問`;

    // 問題文
    document.getElementById(
        "practice-question"
    ).innerHTML = question.question;

    // 選択肢エリア
    const choicesContainer =
        document.getElementById("practice-choices");

    choicesContainer.innerHTML = "";

    // 結果をリセット
    const result =
        document.getElementById("practice-result");

    result.textContent = "";
    result.className = "practice-result";

    // 次の問題ボタンを隠す
    document.getElementById(
        "practice-next-btn"
    ).style.display = "none";


    // ==========================================
    // 選択式
    // ==========================================

    if (question.type === "選択式") {

        const shuffledChoices =
            shuffleArray([...question.choices]);

        shuffledChoices.forEach(choice => {

            const button =
                document.createElement("button");

            button.className =
                "practice-choice";

            button.innerHTML = choice;

            button.onclick = function() {

                answerPracticeQuestion(
                    button,
                    choice,
                    question
                );

            };

            choicesContainer.appendChild(button);
        });
    }


    // ==========================================
    // 記述式
    // ==========================================

    else if (question.type === "記述式") {

        const input =
            document.createElement("input");

        input.type = "text";
        input.id = "practice-answer-input";
        input.className = "practice-answer-input";
        input.placeholder = "答えを入力してください";

        const answerButton =
            document.createElement("button");

        answerButton.textContent = "回答する";
        answerButton.className =
            "practice-submit-btn";

        answerButton.onclick = function() {

            const userAnswer =
                input.value.trim();

            if (userAnswer === "") {
                alert("答えを入力してください。");
                return;
            }

            answerPracticeQuestion(
                input,
                userAnswer,
                question
            );
        };


        // Enterキーでも回答できる
        input.addEventListener(
            "keydown",
            function(event) {

                if (event.key === "Enter") {

                    event.preventDefault();

                    answerButton.click();
                }
            }
        );


        choicesContainer.appendChild(input);
        choicesContainer.appendChild(answerButton);
    }


    // MathJax
    if (window.MathJax) {
        MathJax.typesetPromise();
    }
}


// ==========================================
// 問題に回答
// ==========================================

function answerPracticeQuestion(
    selectedElement,
    selectedAnswer,
    question
) {

    const result =
        document.getElementById(
            "practice-result"
        );


    // ==========================================
    // すでに回答済みなら何もしない
    // ==========================================

    if (result.classList.contains("answered")) {
        return;
    }

    result.classList.add("answered");


    // ==========================================
    // 入力された答えを整える
    // ==========================================

    const userAnswer =
        selectedAnswer
            .trim()
            .toLowerCase();

    const correctAnswer =
        question.answer
            .trim()
            .toLowerCase();


    // ==========================================
    // 選択式の場合
    // ==========================================

    if (question.type === "選択式") {

        const buttons =
            document.querySelectorAll(
                ".practice-choice"
            );

        buttons.forEach(button => {

            button.disabled = true;
            button.classList.add("disabled");

        });
    }


    // ==========================================
    // 記述式の場合
    // ==========================================

    else if (question.type === "記述式") {

        const input =
            document.getElementById(
                "practice-answer-input"
            );

        const submitButton =
            document.querySelector(
                ".practice-submit-btn"
            );

        if (input) {
            input.disabled = true;
        }

        if (submitButton) {
            submitButton.disabled = true;
        }
    }


    // ==========================================
    // 正解
    // ==========================================

    if (userAnswer === correctAnswer) {

        practiceCorrectCount++;


        // 選択式なら選んだボタンを正解表示
        if (question.type === "選択式") {

            selectedElement.classList.add(
                "correct"
            );
        }


        result.textContent = "正解！";

        result.className =
            "practice-result correct-result answered";
    }


    // ==========================================
    // 不正解
    // ==========================================

    else {

        // 間違えた問題を記録
        if (!isRetryingWrongQuestions) {

            const questionIndex =
                practiceQuestionOrder[
                    currentPracticeQuestion
                ];

            if (
                !practiceWrongQuestions.includes(
                    questionIndex
                )
            ) {

                practiceWrongQuestions.push(
                    questionIndex
                );
            }
        }


        // 選択式の場合
        if (question.type === "選択式") {

            const buttons =
                document.querySelectorAll(
                    ".practice-choice"
                );

            // 正解の選択肢を表示
            buttons.forEach(button => {

                if (
                    button.textContent.trim() ===
                    question.answer.trim()
                ) {

                    button.classList.add(
                        "correct"
                    );
                }

            });
        }


        result.innerHTML =
            `不正解！<br>
             正解は「${question.answer}」です。`;

        // 記述式なら解説も表示
        if (question.explanation) {

            result.innerHTML +=
                `<br><br>
                 <strong>解説：</strong><br>
                 ${question.explanation}`;
        }

        result.className =
            "practice-result incorrect-result answered";
    }


    // ==========================================
    // 次の問題ボタン
    // ==========================================

    const nextButton =
        document.getElementById(
            "practice-next-btn"
        );

    nextButton.style.display = "block";


    if (
        currentPracticeQuestion ===
        practiceQuestionOrder.length - 1
    ) {

        nextButton.textContent =
            "結果を見る";

    } else {

        nextButton.textContent =
            "次の問題 →";
    }
}


// ==========================================
// 次の問題
// ==========================================

function nextPracticeQuestion() {

    currentPracticeQuestion++;

    // 全問終了
    if (
        currentPracticeQuestion >=
        practiceQuestionOrder.length
    ) {

        showPracticeResult();

        return;
    }

    showPracticeQuestion();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ==========================================
// 結果表示
// ==========================================

function showPracticeResult() {

    const percentage =
        Math.round(
            (practiceCorrectCount /
                practiceQuestionOrder.length) * 100
        );

    document.getElementById(
        "practice-question-number"
    ).textContent =
        "練習問題終了！";

    document.getElementById(
        "practice-question"
    ).innerHTML =
        `お疲れさまでした！<br>
         あなたの正解数は
         <strong>${practiceCorrectCount} / ${practiceQuestionOrder.length}問</strong>
         です。<br>
         正答率：<strong>${percentage}%</strong>`;

    document.getElementById(
        "practice-choices"
    ).innerHTML = "";

    document.getElementById(
        "practice-result"
    ).textContent =
        "もう一度挑戦してみよう！";

    document.getElementById(
        "practice-result"
    ).className =
        "practice-result correct-result";


    // -------------------------
    // もう一度挑戦する
    // -------------------------

    const nextButton =
        document.getElementById(
            "practice-next-btn"
        );

    nextButton.style.display = "block";
    nextButton.textContent =
        "もう一度挑戦する";

    nextButton.onclick = function() {

        startPractice();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };


    // -------------------------
    // 間違えた問題をもう一回
    // -------------------------

    const wrongButton =
        document.getElementById(
            "practice-wrong-btn"
        );

    if (practiceWrongQuestions.length > 0) {
        wrongButton.style.display = "block";
    } else {
        wrongButton.style.display = "none";
    }
}
function retryWrongQuestions() {

    currentPracticeQuestion = 0;
    practiceCorrectCount = 0;

    isRetryingWrongQuestions = true;

    practiceQuestionOrder =
        [...practiceWrongQuestions];

    // ★復習中の表示
    document.getElementById(
        "practice-retry-label"
    ).style.display = "block";

    // 次の問題ボタンを通常の動作に戻す
    document.getElementById(
        "practice-next-btn"
    ).onclick = nextPracticeQuestion;

    document.getElementById(
        "practice-next-btn"
    ).style.display = "none";

    showPracticeQuestion();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}
