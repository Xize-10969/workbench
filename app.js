```javascript
/**
 * 姜宁的工作台 - 核心逻辑
 * 纯前端应用，数据存储于 localStorage
 */

// ==================== 数据管理 ====================
const STORAGE_KEY = 'jiangning_workbench_v1';
const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WORK_DAYS = [1, 2, 3, 4, 5]; // 周一到周五
const REQUIRED_WEEK_HOURS = 40;
const REQUIRED_DAILY_HOURS = 8;
const PET_DANGER_HP = 40;
const PET_DAILY_HP = 20;
const GOAL_DISCOUNT = 0.25;

// 全局数据
let DB = null;

/**
 * 初始化默认数据
 */
function getDefaultData() {
    return {
        settings: { ownerName: '姜宁' },
        tasks: { daily: {} },
        weeklyGoals: [],
        pet: {
            name: '小红狐',
            alive: true,
            hp: 100,
            chickens: 0,
            lastCheckInDate: null,
            deathDate: null,
            recoveryStreak: { week1Completed: false, week2Completed: false },
            recoveryWeeks: [], // 记录连续合格的周
            dangerStreak: 0,
            dangerResolved: true
        },
        weekData: {},
        lastActiveDate: null
    };
}

/**
 * 加载数据
 */
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            DB = JSON.parse(raw);
            // 确保结构完整
            const def = getDefaultData();
            DB.settings = Object.assign({}, def.settings, DB.settings || {});
            DB.tasks = DB.tasks || { daily: {} };
            DB.tasks.daily = DB.tasks.daily || {};
            DB.weeklyGoals = DB.weeklyGoals || [];
            DB.pet = Object.assign({}, def.pet, DB.pet || {});
            DB.pet.recoveryStreak = Object.assign({}, def.pet.recoveryStreak, (DB.pet || {}).recoveryStreak || {});
            DB.weekData = DB.weekData || {};
        } else {
            DB = getDefaultData();
        }
    } catch(e) {
        console.error('数据加载失败', e);
        DB = getDefaultData();
    }
}

/**
 * 保存数据
 */
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

/**
 * 生成唯一 ID
 */
function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ==================== 日期/周管理 ====================

/**
 * 格式化日期 YYYY-MM-DD
 */
function fmtDate(d) {
    if (typeof d === 'string') return d;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * 获取今天的日期字符串
 */
function todayStr() {
    return fmtDate(new Date());
}

/**
 * 获取周一日期
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 周日归到上周
    d.setDate(d.getDate() + diff);
    return d;
}

/**
 * 获取周标识 YYYY-WNN
 */
function getWeekKey(date) {
    const d = getWeekStart(date);
    const y = d.getFullYear();
    const jan1 = new Date(y, 0, 1);
    const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${y}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * 获取本周所有日期（周一到周日）
 */
function getWeekDates(date) {
    const start = getWeekStart(date);
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d);
    }
    return dates;
}

/**
 * 判断是否是工作日
 */
function isWorkDay(date) {
    const day = date.getDay();
    return WORK_DAYS.includes(day);
}

/**
 * 获取日期差（天数）
 */
function daysBetween(d1, d2) {
    const diff = Math.abs(new Date(d1) - new Date(d2));
    return Math.floor(diff / 86400000);
}

// ==================== 任务管理 ====================

/**
 * 获取某天的任务列表
 */
function getDayTasks(dateStr) {
    if (!DB.tasks.daily[dateStr]) return [];
    return DB.tasks.daily[dateStr];
}

/**
 * 获取某天学习总时长
 */
function getDayHours(dateStr) {
    const tasks = getDayTasks(dateStr);
    return tasks.reduce((sum, t) => sum + (parseFloat(t.duration) || 0), 0);
}

/**
 * 获取某天已完成任务数
 */
function getDayCompletedCount(dateStr) {
    const tasks = getDayTasks(dateStr);
    return tasks.filter(t => t.completed).length;
}

/**
 * 获取某天是否所有任务都完成了
 */
function isDayAllCompleted(dateStr) {
    const tasks = getDayTasks(dateStr);
    if (tasks.length === 0) return false;
    return tasks.every(t => t.completed);
}

/**
 * 获取某天是否可以打卡（所有任务完成 且 时长达标）
 */
function canCheckIn(dateStr) {
    return isDayAllCompleted(dateStr) && getDayHours(dateStr) >= REQUIRED_DAILY_HOURS;
}

/**
 * 获取某天是否已打卡
 */
function isDayCheckedIn(dateStr) {
    const weekKey = getWeekKey(dateStr);
    if (!DB.weekData[weekKey]) return false;
    if (!DB.weekData[weekKey].days) return false;
    if (!DB.weekData[weekKey].days[dateStr]) return false;
    return DB.weekData[weekKey].days[dateStr].checkedIn === true;
}

// ==================== 一周目标管理 ====================

/**
 * 获取已完成的一周目标数
 */
function getCompletedGoalsCount() {
    return DB.weeklyGoals.filter(g => g.completed).length;
}

/**
 * 获取本周有效学习时长要求
 */
function getRequiredWeekHours() {
    const discount = getCompletedGoalsCount() * GOAL_DISCOUNT;
    return Math.max(0, REQUIRED_WEEK_HOURS * (1 - discount));
}

/**
 * 获取本周实际学习总时长（只算打卡成功的天）
 */
function getWeekActualHours(date) {
    const weekDates = getWeekDates(date);
    let total = 0;
    weekDates.forEach(d => {
        const ds = fmtDate(d);
        if (isDayCheckedIn(ds)) {
            total += getDayHours(ds);
        }
    });
    return total;
}

/**
 * 获取本周所有天数的学习时长（含未打卡的）
 */
function getWeekAllHours(date) {
    const weekDates = getWeekDates(date);
    let total = 0;
    weekDates.forEach(d => {
        const ds = fmtDate(d);
        total += getDayHours(ds);
    });
    return total;
}

/**
 * 获取本周完成任务总数
 */
function getWeekCompletedTasksCount(date) {
    const weekDates = getWeekDates(date);
    let total = 0;
    weekDates.forEach(d => {
        const ds = fmtDate(d);
        total += getDayCompletedCount(ds);
    });
    return total;
}

// ==================== 宠物生命值引擎 ====================

/**
 * 获取宠物状态描述
 */
function getPetStatus() {
    const hp = DB.pet.hp;
    if (!DB.pet.alive) return { text: '已死亡', level: 'dead' };
    if (hp <= PET_DANGER_HP) return { text: '生命危险！需要连续2天打卡恢复', level: 'low' };
    if (hp <= 60) return { text: '有些虚弱，请坚持学习', level: 'mid' };
    if (hp <= 80) return { text: '状态良好', level: 'mid' };
    return { text: '精力充沛', level: 'high' };
}

/**
 * 每日结算：检查昨日是否打卡，未打卡扣血
 * 在每次打开 App 时调用
 */
function dailySettlement() {
    const today = todayStr();
    const lastActive = DB.lastActiveDate;
    
    if (lastActive && lastActive !== today) {
        // 检查从 lastActive 到 today 之间的所有工作日
        // 只结算 lastActive 当天的打卡状态
        if (!DB.pet.alive) {
            DB.lastActiveDate = today;
            saveData();
            return;
        }

        // 检查昨天是否应该打卡但没打
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = fmtDate(yesterday);
        
        // 如果上次活跃不是今天，结算从上次活跃日到昨天的每一天
        const startDate = new Date(lastActive);
        const endDate = new Date(yesterday);
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const ds = fmtDate(d);
            // 只处理工作日
            if (!isWorkDay(d)) continue;
            // 如果这天没打卡，扣血
            if (!isDayCheckedIn(ds) && DB.pet.alive) {
                // 检查是否处于危险模式
                if (DB.pet.hp <= PET_DANGER_HP) {
                    // 危险模式：连续2天打卡中如果断了，重置
                    DB.pet.dangerStreak = 0;
                }
                DB.pet.hp = Math.max(0, DB.pet.hp - PET_DAILY_HP);
                
                if (DB.pet.hp <= 0) {
                    DB.pet.hp = 0;
                    DB.pet.alive = false;
                    DB.pet.deathDate = today;
                    showToast('💔 你的小狐狸生命值归零，已死亡...', 'danger');
                    break;
                }
            }
        }
    }
    
    DB.lastActiveDate = today;
    saveData();
}

/**
 * 打卡
 */
function checkIn() {
    const today = todayStr();
    
    if (!DB.pet.alive) {
        showToast('宠物已死亡，无法打卡', 'warning');
        return;
    }
    
    if (isDayCheckedIn(today)) {
        showToast('今天已经打卡了', 'warning');
        return;
    }
    
    if (!canCheckIn(today)) {
        const hours = getDayHours(today);
        const allDone = isDayAllCompleted(today);
        if (!allDone) {
            showToast('请先完成所有任务', 'warning');
        } else if (hours < REQUIRED_DAILY_HOURS) {
            showToast(`学习时长不足，还需 ${(REQUIRED_DAILY_HOURS - hours).toFixed(1)} 小时`, 'warning');
        }
        return;
    }
    
    // 打卡成功
    const weekKey = getWeekKey(today);
    if (!DB.weekData[weekKey]) DB.weekData[weekKey] = { days: {} };
    if (!DB.weekData[weekKey].days) DB.weekData[weekKey].days = {};
    if (!DB.weekData[weekKey].days[today]) DB.weekData[weekKey].days[today] = {};
    DB.weekData[weekKey].days[today].checkedIn = true;
    DB.pet.lastCheckInDate = today;
    
    // 处理鸡腿和生命值逻辑
    handleCheckInReward();
    
    saveData();
    renderAll();
    
    // 鸡腿飞出动画
    flyChicken();
    
    showToast('打卡成功！🍗+1', 'success');
}

/**
 * 打卡奖励处理
 */
function handleCheckInReward() {
    const hp = DB.pet.hp;
    
    if (hp > PET_DANGER_HP) {
        // 正常状态：获得鸡腿存入库存
        DB.pet.chickens += 1;
        showToast('获得一个鸡腿，可手动喂食恢复生命值', 'success');
    } else {
        // 危险状态：鸡腿用于防扣血（消耗鸡腿，不扣血）
        DB.pet.dangerStreak = (DB.pet.dangerStreak || 0) + 1;
        
        if (DB.pet.dangerStreak >= 2) {
            // 连续2天打卡完成，脱离危险
            DB.pet.dangerResolved = true;
            DB.pet.dangerStreak = 0;
            showToast('🎉 连续2天打卡完成，脱离危险状态！', 'success');
            // 脱离危险后恢复正常，给一个鸡腿作为奖励
            DB.pet.chickens += 1;
        } else {
            showToast(`危险状态：需连续2天打卡恢复（${DB.pet.dangerStreak}/2）`, 'warning');
        }
    }
}

/**
 * 喂食鸡腿
 */
function feedPet() {
    if (!DB.pet.alive) {
        showToast('宠物已死亡', 'warning');
        return;
    }
    
    if (DB.pet.chickens <= 0) {
        showToast('没有鸡腿了，请先完成任务打卡', 'warning');
        return;
    }
    
    if (DB.pet.hp >= 100) {
        showToast('小狐狸已经满血了', 'warning');
        return;
    }
    
    if (DB.pet.hp <= PET_DANGER_HP) {
        showToast('生命值低于40%，库存鸡腿无法恢复血量。需连续2天打卡恢复', 'warning');
        return;
    }
    
    // 恢复 20% 生命值
    DB.pet.chickens -= 1;
    const before = DB.pet.hp;
    DB.pet.hp = Math.min(100, DB.pet.hp + PET_DAILY_HP);
    const recovered = DB.pet.hp - before;
    
    showToast(`恢复 ${recovered}% 生命值，当前 ${DB.pet.hp}%`, 'success');
    saveData();
    renderAll();
}

/**
 * 检查本周是否合格
 */
function isWeekQualified(date) {
    const required = getRequiredWeekHours();
    const actual = getWeekActualHours(date);
    return actual >= required;
}

/**
 * 检查死亡后恢复条件
 */
function checkRecoveryCondition() {
    if (DB.pet.alive) return { canClaim: false, reason: '宠物还活着' };
    
    // 检查死亡后连续两周是否都合格
    // recoveryWeeks 记录死亡后每周的合格状态
    const today = new Date();
    const deathDate = new Date(DB.pet.deathDate);
    
    // 计算死亡后过了几周
    const deathWeekKey = getWeekKey(deathDate);
    const todayWeekKey = getWeekKey(today);
    
    // 获取恢复周记录
    if (!DB.pet.recoveryWeeks) DB.pet.recoveryWeeks = [];
    
    // 如果有两周以上合格记录
    const qualifiedWeeks = DB.pet.recoveryWeeks.filter(w => w.qualified).length;
    
    if (qualifiedWeeks >= 2) {
        return { canClaim: true, reason: '连续两周任务按时完成，可领取新宠物' };
    }
    
    return { 
        canClaim: false, 
        reason: `需连续两周任务合格（已完成 ${qualifiedWeeks}/2 周）`,
        qualifiedWeeks
    };
}

/**
 * 领取新宠物
 */
function claimNewPet() {
    const recovery = checkRecoveryCondition();
    if (!recovery.canClaim) {
        showToast(recovery.reason, 'warning');
        return;
    }
    
    DB.pet = {
        name: '小红狐',
        alive: true,
        hp: 100,
        chickens: 0,
        lastCheckInDate: todayStr(),
        deathDate: null,
        recoveryStreak: { week1Completed: false, week2Completed: false },
        recoveryWeeks: [],
        dangerStreak: 0,
        dangerResolved: true
    };
    
    showToast('🎉 恢复完成，新宠物已领取！', 'success');
    saveData();
    renderAll();
}

/**
 * 每周结算：检查恢复条件
 * 在打开 App 或切换到宠物页面时调用
 */
function weeklySettlement() {
    if (!DB.pet.alive && DB.pet.deathDate) {
        // 检查本周是否合格，如果合格则记录到 recoveryWeeks
        const today = new Date();
        const todayWeekKey = getWeekKey(today);
        
        if (!DB.pet.recoveryWeeks) DB.pet.recoveryWeeks = [];
        
        // 检查本周是否已记录
        const existing = DB.pet.recoveryWeeks.find(w => w.weekKey === todayWeekKey);
        if (!existing && isWeekQualified(today)) {
            DB.pet.recoveryWeeks.push({ weekKey: todayWeekKey, qualified: true });
        }
        
        // 清理超过4周的记录
        if (DB.pet.recoveryWeeks.length > 4) {
            DB.pet.recoveryWeeks = DB.pet.recoveryWeeks.slice(-4);
        }
    }
    saveData();
}

// ==================== 页面渲染 ====================

/**
 * 渲染所有页面
 */
function renderAll() {
    renderTodayPage();
    renderWeekPage();
    renderPetPage();
    renderHeader();
}

/**
 * 渲染顶部导航栏的迷你宠物
 */
function renderHeader() {
    const el = document.getElementById('headerPetMini');
    if (DB.pet.alive) {
        const hp = DB.pet.hp;
        let icon = '🦊';
        if (hp <= PET_DANGER_HP) icon = '🦊';
        el.innerHTML = `<span class="mini-fox">${icon}</span><span class="mini-hp">${hp}%</span>`;
    } else {
        el.innerHTML = '<span class="mini-fox">💀</span>';
    }
}

/**
 * 渲染今日页面
 */
function renderTodayPage() {
    const today = todayStr();
    const d = new Date();
    
    // 日期
    document.getElementById('todayDate').textContent = 
        `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${DAY_NAMES[d.getDay()]}`;
    
    // 学习时长
    const hours = getDayHours(today);
    const progress = Math.min(100, (hours / REQUIRED_DAILY_HOURS) * 100);
    document.getElementById('todayHours').textContent = `${hours.toFixed(1)}h / ${REQUIRED_DAILY_HOURS}h`;
    document.getElementById('todayProgress').style.width = progress + '%';
    
    const remaining = REQUIRED_DAILY_HOURS - hours;
    if (remaining > 0) {
        document.getElementById('todayProgressLabel').textContent = `还需 ${remaining.toFixed(1)} 小时`;
    } else {
        document.getElementById('todayProgressLabel').textContent = '✓ 今日时长已达标';
    }
    
    // 任务列表
    const tasks = getDayTasks(today);
    const listEl = document.getElementById('todayTaskList');
    if (tasks.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <div>还没有任务，点击 + 添加</div>
            </div>
        `;
    } else {
        listEl.innerHTML = tasks.map(t => `
            <div class="task-item ${t.completed ? 'completed' : ''}">
                <div class="task-check" onclick="toggleTask('${t.id}')">${t.completed ? '✓' : ''}</div>
                <div class="task-info">
                    <div class="task-name">${escapeHtml(t.name)}</div>
                    <div class="task-duration">${t.duration} 小时</div>
                </div>
                <div class="task-actions">
                    <button onclick="editTask('${t.id}')">✏️</button>
                    <button onclick="deleteTask('${t.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }
    
    // 打卡按钮
    const btnCheckin = document.getElementById('btnCheckin');
    const checkinHint = document.getElementById('checkinHint');
    
    if (isDayCheckedIn(today)) {
        btnCheckin.disabled = true;
        btnCheckin.innerHTML = '<span class="checkin-icon">✅</span><span>今日已打卡</span>';
        checkinHint.textContent = '今天辛苦啦，继续加油！';
    } else if (canCheckIn(today)) {
        btnCheckin.disabled = false;
        btnCheckin.innerHTML = '<span class="checkin-icon">🍗</span><span>完成打卡</span>';
        checkinHint.textContent = '所有任务已完成，可以打卡啦！';
    } else {
        btnCheckin.disabled = false;
        const hours = getDayHours(today);
        const allDone = isDayAllCompleted(today);
        if (!allDone) {
            checkinHint.textContent = `还有 ${tasks.length - getDayCompletedCount(today)} 个任务未完成`;
        } else if (hours < REQUIRED_DAILY_HOURS) {
            checkinHint.textContent = `时长还差 ${(REQUIRED_DAILY_HOURS - hours).toFixed(1)} 小时`;
        }
        if (tasks.length === 0) {
            checkinHint.textContent = '请先添加今日任务';
        }
    }
}

/**
 * 渲染一周页面
 */
function renderWeekPage() {
    const today = new Date();
    const weekDates = getWeekDates(today);
    const weekKey = getWeekKey(today);
    
    // 一周总览
    const actualHours = getWeekActualHours(today);
    const requiredHours = getRequiredWeekHours();
    const allHours = getWeekAllHours(today);
    const completedTasks = getWeekCompletedTasksCount(today);
    const completedGoals = getCompletedGoalsCount();
    
    document.getElementById('weekTotalHours').textContent = allHours.toFixed(1) + 'h';
    document.getElementById('weekActualHours').textContent = actualHours.toFixed(1) + 'h';
    document.getElementById('weekRequiredHours').textContent = requiredHours.toFixed(1) + 'h';
    document.getElementById('weekCompletedTasks').textContent = completedTasks;
    
    // 环形进度
    const ringProgress = Math.min(100, (actualHours / requiredHours) * 100);
    const ringEl = document.getElementById('weekProgressRing');
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (ringProgress / 100) * circumference;
    ringEl.innerHTML = `
        <svg width="150" height="150" viewBox="0 0 150 150">
            <circle cx="75" cy="75" r="${radius}" fill="none" stroke="#FFE0CC" stroke-width="12"/>
            <circle cx="75" cy="75" r="${radius}" fill="none" stroke="#FF6B35" stroke-width="12"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                stroke-linecap="round" transform="rotate(-90 75 75)"
                style="transition: stroke-dashoffset 0.5s ease;"/>
            <text x="75" y="72" text-anchor="middle" font-size="22" font-weight="700" fill="#FF6B35">${ringProgress.toFixed(0)}%</text>
            <text x="75" y="92" text-anchor="middle" font-size="12" fill="#636E72">完成度</text>
        </svg>
    `;
    
    // 一周状态
    const statusEl = document.getElementById('weekStatus');
    if (actualHours >= requiredHours) {
        statusEl.className = 'week-status success';
        statusEl.textContent = '✓ 本周学习合格，继续加油！';
    } else {
        statusEl.className = 'week-status warning';
        const gap = requiredHours - actualHours;
        statusEl.textContent = `还需 ${gap.toFixed(1)} 小时达到本周要求`;
    }
    
    // 每日学习时长列表
    const dailyListEl = document.getElementById('dailyHoursList');
    dailyListEl.innerHTML = weekDates.map((d, i) => {
        const ds = fmtDate(d);
        const hours = getDayHours(ds);
        const checkedIn = isDayCheckedIn(ds);
        const isToday = ds === todayStr();
        const isPast = d < new Date(new Date().setHours(0,0,0,0));
        const isWorkday = isWorkDay(d);
        
        let status = '';
        let statusClass = '';
        if (checkedIn) {
            status = '✓ 已打卡';
            statusClass = 'done';
        } else if (isToday) {
            status = '今日';
            statusClass = 'pending';
        } else if (isPast && isWorkday) {
            status = '未完成';
            statusClass = 'missed';
        } else if (!isWorkday) {
            status = '休息日';
        } else {
            status = '待完成';
            statusClass = 'pending';
        }
        
        return `
            <div class="daily-hour-item ${isToday ? 'today' : ''}">
                <span class="day-name">${DAY_NAMES[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}</span>
                <span class="day-hours">${hours.toFixed(1)}h</span>
                <span class="day-status ${statusClass}">${status}</span>
            </div>
        `;
    }).join('');
    
    // 一周目标任务
    renderWeeklyGoals();
}

/**
 * 渲染一周目标任务
 */
function renderWeeklyGoals() {
    const listEl = document.getElementById('weeklyGoalList');
    if (DB.weeklyGoals.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <div>还没有一周目标，点击 + 添加</div>
            </div>
        `;
    } else {
        listEl.innerHTML = DB.weeklyGoals.map(g => `
            <div class="goal-item ${g.completed ? 'completed' : ''}">
                <div class="goal-check" onclick="toggleGoal('${g.id}')">${g.completed ? '✓' : ''}</div>
                <div class="goal-name">${escapeHtml(g.name)}</div>
                <div class="goal-actions">
                    <button onclick="editGoal('${g.id}')">✏️</button>
                    <button onclick="deleteGoal('${g.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }
    
    // 提示
    const completed = getCompletedGoalsCount();
    const required = getRequiredWeekHours();
    const hintEl = document.getElementById('goalHint');
    if (DB.weeklyGoals.length === 0) {
        hintEl.textContent = '每完成一项一周目标，可折减25%的学习时长要求';
    } else {
        hintEl.textContent = `已完成 ${completed} 项，当前要求学习 ${required.toFixed(1)} 小时`;
    }
}

/**
 * 渲染宠物页面
 */
function renderPetPage() {
    const displayEl = document.getElementById('petDisplay');
    const hp = DB.pet.hp;
    
    // 狐狸 SVG
    displayEl.className = 'pet-display';
    if (!DB.pet.alive) {
        displayEl.classList.add('dead');
    } else if (hp <= PET_DANGER_HP) {
        displayEl.classList.add('danger');
    } else if (hp > 80) {
        displayEl.classList.add('happy');
    }
    displayEl.innerHTML = getFoxSVG(hp, DB.pet.alive);
    
    // 名字和生命值
    document.getElementById('petName').textContent = DB.pet.name;
    document.getElementById('petHpText').textContent = DB.pet.alive ? hp + '%' : '已死亡';
    
    // 生命值条
    const hpFill = document.getElementById('hpFill');
    hpFill.style.width = (DB.pet.alive ? hp : 0) + '%';
    hpFill.className = 'hp-fill';
    if (hp > 60 || !DB.pet.alive) {
        if (DB.pet.alive) hpFill.classList.add('high');
    } else if (hp > PET_DANGER_HP) {
        hpFill.classList.add('mid');
    } else {
        hpFill.classList.add('low');
    }
    
    // 生命值状态
    const status = getPetStatus();
    const hpStatusEl = document.getElementById('hpStatus');
    hpStatusEl.textContent = status.text;
    hpStatusEl.className = 'hp-status';
    if (hp <= PET_DANGER_HP && DB.pet.alive) {
        hpStatusEl.classList.add('warning');
    }
    
    // 鸡腿库存
    document.getElementById('chickenCount').textContent = DB.pet.chickens;
    
    // 喂食按钮
    const btnFeed = document.getElementById('btnFeed');
    if (!DB.pet.alive || DB.pet.chickens <= 0 || hp >= 100 || hp <= PET_DANGER_HP) {
        btnFeed.disabled = true;
    } else {
        btnFeed.disabled = false;
    }
    
    // 宠物消息
    const msgEl = document.getElementById('petMessage');
    if (!DB.pet.alive) {
        const recovery = checkRecoveryCondition();
        msgEl.className = 'pet-message warning';
        msgEl.textContent = `💔 ${DB.pet.name}已死亡。${recovery.reason}`;
        // 显示领取新宠物
        document.getElementById('newPetSection').style.display = 'block';
        const recoveryEl = document.getElementById('recoveryProgress');
        const qualifiedWeeks = recovery.qualifiedWeeks || 0;
        recoveryEl.innerHTML = `
            <div>恢复进度：${qualifiedWeeks} / 2 周合格</div>
            <div class="recovery-week">
                <span class="recovery-week-dot ${qualifiedWeeks >= 1 ? 'done' : ''}"></span>
                <span>第一周</span>
                <span class="recovery-week-dot ${qualifiedWeeks >= 2 ? 'done' : ''}"></span>
                <span>第二周</span>
            </div>
        `;
        const btnNewPet = document.querySelector('.btn-new-pet');
        if (btnNewPet) {
            btnNewPet.disabled = !recovery.canClaim;
        }
    } else {
        document.getElementById('newPetSection').style.display = 'none';
        if (hp <= PET_DANGER_HP) {
            msgEl.className = 'pet-message warning';
            const streak = DB.pet.dangerStreak || 0;
            if (streak > 0) {
                msgEl.textContent = `⚠️ 危险状态！需连续2天打卡恢复（${streak}/2），库存鸡腿暂不可用`;
            } else {
                msgEl.textContent = `⚠️ 危险状态！请连续2天完成学习任务打卡来恢复`;
            }
        } else if (hp > 80) {
            msgEl.className = 'pet-message success';
            msgEl.textContent = `😊 ${DB.pet.name}状态很好，继续保持！`;
        } else {
            msgEl.className = 'pet-message info';
            msgEl.textContent = `📉 ${DB.pet.name}生命值下降了，可以用鸡腿恢复哦`;
        }
    }
}

/**
 * 获取狐狸 SVG
 */
function getFoxSVG(hp, alive) {
    if (!alive) {
        return `
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <!-- 狐狸身体 -->
                <ellipse cx="100" cy="130" rx="55" ry="50" fill="#A04020" opacity="0.7"/>
                <!-- 头 -->
                <circle cx="100" cy="80" r="42" fill="#FF6B35" opacity="0.5"/>
                <!-- 耳朵 -->
                <polygon points="70,50 80,15 95,45" fill="#E55100" opacity="0.5"/>
                <polygon points="130,50 120,15 105,45" fill="#E55100" opacity="0.5"/>
                <!-- X眼 -->
                <text x="80" y="85" font-size="20" fill="#666" font-weight="bold">✕</text>
                <text x="115" y="85" font-size="20" fill="#666" font-weight="bold">✕</text>
                <!-- 嘴 -->
                <path d="M100,95 Q95,105 90,100" fill="none" stroke="#666" stroke-width="2"/>
                <!-- 魂 -->
                <text x="100" y="160" font-size="24" text-anchor="middle" opacity="0.5">👻</text>
            </svg>
        `;
    }
    
    // 根据生命值确定表情
    const happy = hp > 60;
    const danger = hp <= PET_DANGER_HP;
    const mid = hp > PET_DANGER_HP && hp <= 60;
    
    // 眼睛
    let leftEye, rightEye;
    if (happy) {
        leftEye = `<path d="M75,80 Q80,75 85,80" fill="none" stroke="#2D3436" stroke-width="3" stroke-linecap="round"/>`;
        rightEye = `<path d="M115,80 Q120,75 125,80" fill="none" stroke="#2D3436" stroke-width="3" stroke-linecap="round"/>`;
    } else if (danger) {
        leftEye = `<path d="M72,75 L82,85 M82,75 L72,85" stroke="#E84393" stroke-width="2.5" stroke-linecap="round"/>`;
        rightEye = `<path d="M118,75 L128,85 M128,75 L118,85" stroke="#E84393" stroke-width="2.5" stroke-linecap="round"/>`;
    } else {
        leftEye = `<circle cx="80" cy="80" r="4" fill="#2D3436"/>`;
        rightEye = `<circle cx="120" cy="80" r="4" fill="#2D3436"/>`;
    }
    
    // 嘴
    let mouth;
    if (happy) {
        mouth = `<path d="M90,95 Q100,108 110,95" fill="none" stroke="#2D3436" stroke-width="2.5" stroke-linecap="round"/>`;
    } else if (danger) {
        mouth = `<path d="M90,105 Q100,98 110,105" fill="none" stroke="#2D3436" stroke-width="2.5" stroke-linecap="round"/>`;
    } else {
        mouth = `<line x1="92" y1="100" x2="108" y2="100" stroke="#2D3436" stroke-width="2.5" stroke-linecap="round"/>`;
    }
    
    // 腮红（开心时）
    const blush = happy ? `
        <circle cx="68" cy="90" r="6" fill="#FFB3A7" opacity="0.6"/>
        <circle cx="132" cy="90" r="6" fill="#FFB3A7" opacity="0.6"/>
    ` : '';
    
    // 汗滴（危险时）
    const sweat = danger ? `
        <path d="M140,60 Q142,68 138,70 Q134,68 136,60 Z" fill="#74B9FF" opacity="0.8"/>
    ` : '';
    
    return `
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <!-- 尾巴 -->
            <ellipse cx="50" cy="140" rx="20" ry="30" fill="#FF6B35" transform="rotate(-30 50 140)"/>
            <ellipse cx="45" cy="125" rx="12" ry="15" fill="#FFFFFF" transform="rotate(-30 45 125)"/>
            
            <!-- 身体 -->
            <ellipse class="fox-body" cx="100" cy="135" rx="50" ry="45" fill="#FF6B35"/>
            <ellipse cx="100" cy="145" rx="30" ry="28" fill="#FFF5E6"/>
            
            <!-- 腿 -->
            <rect x="75" y="170" width="14" height="18" rx="7" fill="#E55100"/>
            <rect x="111" y="170" width="14" height="18" rx="7" fill="#E55100"/>
            
            <!-- 头 -->
            <circle cx="100" cy="75" r="45" fill="#FF6B35"/>
            
            <!-- 耳朵 -->
            <polygon points="68,45 72,15 95,40" fill="#E55100"/>
            <polygon points="132,45 128,15 105,40" fill="#E55100"/>
            <polygon points="75,38 78,25 88,38" fill="#FFC0B0"/>
            <polygon points="125,38 122,25 112,38" fill="#FFC0B0"/>
            
            <!-- 脸部白色区域 -->
            <ellipse cx="100" cy="85" rx="28" ry="25" fill="#FFF5E6"/>
            
            ${blush}
            ${sweat}
            ${leftEye}
            ${rightEye}
            
            <!-- 鼻子 -->
            <ellipse cx="100" cy="92" rx="3.5" ry="2.5" fill="#2D3436"/>
            ${mouth}
            
            <!-- 危险标志 -->
            ${danger ? `<text x="155" y="50" font-size="20">⚠️</text>` : ''}
        </svg>
    `;
}

// ==================== 事件处理 ====================

/**
 * 页面切换
 */
function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab-item[data-page="${page}"]`).classList.add('active');
    
    const titles = {
        today: '今日任务',
        week: '一周统计',
        pet: '我的宠物',
        settings: '设置'
    };
    document.getElementById('pageTitle').textContent = titles[page];
}

/**
 * 显示添加任务弹窗
 */
function showAddTaskModal() {
    document.getElementById('taskId').value = '';
    document.getElementById('taskName').value = '';
    document.getElementById('taskDuration').value = '';
    document.querySelector('#taskModal .modal-title').textContent = '添加学习任务';
    document.getElementById('taskModal').classList.add('active');
    setTimeout(() => document.getElementById('taskName').focus(), 100);
}

/**
 * 编辑任务
 */
function editTask(id) {
    const tasks = getDayTasks(todayStr());
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    document.getElementById('taskId').value = id;
    document.getElementById('taskName').value = task.name;
    document.getElementById('taskDuration').value = task.duration;
    document.querySelector('#taskModal .modal-title').textContent = '编辑任务';
    document.getElementById('taskModal').classList.add('active');
}

/**
 * 保存任务
 */
function saveTask() {
    const id = document.getElementById('taskId').value;
    const name = document.getElementById('taskName').value.trim();
    const duration = parseFloat(document.getElementById('taskDuration').value);
    
    if (!name) {
        showToast('请输入任务名称', 'warning');
        return;
    }
    if (!duration || duration <= 0) {
        showToast('请输入有效的学习时长', 'warning');
        return;
    }
    
    const today = todayStr();
    if (!DB.tasks.daily[today]) DB.tasks.daily[today] = [];
    
    if (id) {
        // 编辑
        const task = DB.tasks.daily[today].find(t => t.id === id);
        if (task) {
            task.name = name;
            task.duration = duration;
        }
    } else {
        // 新增
        DB.tasks.daily[today].push({
            id: genId(),
            name: name,
            duration: duration,
            completed: false
        });
    }
    
    saveData();
    closeModal('taskModal');
    renderAll();
    showToast('任务已保存', 'success');
}

/**
 * 切换任务完成状态
 */
function toggleTask(id) {
    const today = todayStr();
    const task = DB.tasks.daily[today].find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveData();
        renderAll();
    }
}

/**
 * 删除任务
 */
function deleteTask(id) {
    const today = todayStr();
    if (DB.tasks.daily[today]) {
        DB.tasks.daily[today] = DB.tasks.daily[today].filter(t => t.id !== id);
        if (DB.tasks.daily[today].length === 0) {
            delete DB.tasks.daily[today];
        }
        saveData();
        renderAll();
        showToast('任务已删除', 'success');
    }
}

/**
 * 显示添加目标弹窗
 */
function showAddGoalModal() {
    document.getElementById('goalId').value = '';
    document.getElementById('goalName').value = '';
    document.querySelector('#goalModal .modal-title').textContent = '添加一周目标';
    document.getElementById('goalModal').classList.add('active');
    setTimeout(() => document.getElementById('goalName').focus(), 100);
}

/**
 * 编辑目标
 */
function editGoal(id) {
    const goal = DB.weeklyGoals.find(g => g.id === id);
    if (!goal) return;
    
    document.getElementById('goalId').value = id;
    document.getElementById('goalName').value = goal.name;
    document.querySelector('#goalModal .modal-title').textContent = '编辑目标';
    document.getElementById('goalModal').classList.add('active');
}

/**
 * 保存目标
 */
function saveGoal() {
    const id = document.getElementById('goalId').value;
    const name = document.getElementById('goalName').value.trim();
    
    if (!name) {
        showToast('请输入目标名称', 'warning');
        return;
    }
    
    if (id) {
        const goal = DB.weeklyGoals.find(g => g.id === id);
        if (goal) {
            goal.name = name;
        }
    } else {
        DB.weeklyGoals.push({
            id: genId(),
            name: name,
            completed: false,
            completedDate: null
        });
    }
    
    saveData();
    closeModal('goalModal');
    renderAll();
    showToast('目标已保存', 'success');
}

/**
 * 切换目标完成状态
 */
function toggleGoal(id) {
    const goal = DB.weeklyGoals.find(g => g.id === id);
    if (goal) {
        goal.completed = !goal.completed;
        goal.completedDate = goal.completed ? todayStr() : null;
        saveData();
        renderAll();
        if (goal.completed) {
            showToast(`目标完成！学习时长要求减少${GOAL_DISCOUNT * 100}%`, 'success');
        }
    }
}

/**
 * 删除目标
 */
function deleteGoal(id) {
    DB.weeklyGoals = DB.weeklyGoals.filter(g => g.id !== id);
    saveData();
    renderAll();
    showToast('目标已删除', 'success');
}

/**
 * 关闭弹窗
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ==================== 工具函数 ====================

/**
 * HTML 转义
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Toast 提示
 */
let toastTimer = null;
function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

/**
 * 鸡腿飞出动画
 */
function flyChicken() {
    const chicken = document.createElement('div');
    chicken.textContent = '🍗';
    chicken.className = 'chicken-flying';
    chicken.style.left = '50%';
    chicken.style.top = '60%';
    document.body.appendChild(chicken);
    setTimeout(() => chicken.remove(), 1000);
}

/**
 * 导出数据
 */
function exportData() {
    const data = JSON.stringify(DB, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `姜宁工作台_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出', 'success');
}

/**
 * 导入数据
 */
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            DB = data;
            saveData();
            renderAll();
            showToast('数据导入成功', 'success');
        } catch(err) {
            showToast('导入失败：文件格式错误', 'warning');
        }
    };
    reader.readAsText(file);
}

/**
 * 重置数据
 */
function resetData() {
    if (confirm('确定要重置所有数据吗？此操作不可恢复！')) {
        DB = getDefaultData();
        saveData();
        renderAll();
        showToast('数据已重置', 'success');
    }
}

// ==================== 初始化 ====================

/**
 * 应用初始化（带容错）
 */
function initApp() {
    try {
        loadData();
    } catch(e) {
        console.error('loadData 错误:', e);
        DB = getDefaultData();
        saveData();
    }
    
    try {
        dailySettlement();
    } catch(e) { console.error('dailySettlement 错误:', e); }
    
    try {
        weeklySettlement();
    } catch(e) { console.error('weeklySettlement 错误:', e); }
    
    // 检查生命值警告
    try {
        if (DB.pet.alive && DB.pet.hp <= PET_DANGER_HP) {
            setTimeout(() => {
                showToast(`⚠️ ${DB.pet.name}生命值危险！请连续2天打卡恢复`, 'warning');
            }, 500);
        }
    } catch(e) { console.error('警告检查错误:', e); }
    
    try {
        renderAll();
    } catch(e) { console.error('renderAll 错误:', e); }
    
    // 点击遮罩关闭弹窗
    try {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.addEventListener('click', (e) => {
                if (e.target === m) m.classList.remove('active');
            });
        });
    } catch(e) { console.error('弹窗绑定错误:', e); }
}

// 暴露所有函数到全局作用域（防止被误隔离）
window.showAddTaskModal = showAddTaskModal;
window.editTask = editTask;
window.saveTask = saveTask;
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.checkIn = checkIn;
window.feedPet = feedPet;
window.switchPage = switchPage;
window.showAddGoalModal = showAddGoalModal;
window.editGoal = editGoal;
window.saveGoal = saveGoal;
window.toggleGoal = toggleGoal;
window.deleteGoal = deleteGoal;
window.closeModal = closeModal;
window.exportData = exportData;
window.importData = importData;
window.resetData = resetData;
window.claimNewPet = claimNewPet;

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
```
