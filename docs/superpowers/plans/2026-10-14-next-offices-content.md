# 三任剧情与案件施工计划

**目标：**依用户确认的方案，依次接入通判、同知、知府，各18件新事件、4件来源案件，重写原24条主线，并交付兼容与浏览器验收证据。

**架构：**现有三任的钱粮和核心公文保留。独立内容模块定义手写剧情和来源案件；`office-stories.js`负责待办队列、来源消耗、延迟结果、案件程序和存档验证。三任各有可见“剧情与案牍”页，所有操作进入现有dispatch事务与回执。

**技术：**原生JavaScript模块、Node测试、本地HTTP、Codex应用内浏览器。用户要求依次施工，本会话按次序完成，保留工作区既有修改，不另建遗漏这些修改的checkout。

## 1. 通判与共享程序

- [x] 先写`tests/office-stories.test.js`：新通判任命产生内容记录，过去周次不重放，案件立卷后通过三项证据、两周复核、两周执行；错误推断退回；重复命令不重复奖惩。
- [x] 执行`node --test tests/office-stories.test.js`，确认新增行为尚不存在。
- [x] 新建`src/prefecture-stories.js`定义18件手写事件、4件公案；新建`src/office-case-data.js`记录来源与固定案情；`src/office-stories.js`定义并导出`blankOfficeStories`、`syncOfficeStories`、`officeStoryCommand`、`validateOfficeStories`。事件字段为`id,week,title,text,options`；案件字段为`id,week,name,source,summary,clues,hypotheses,options,finding`。
- [x] 在`src/engine.js`创建新档字段、升级存档到v12，在克隆后的命令事务中接入`office_story`和`office_case`，正常推进后同步内容，调用独立验证。剧情队列与原强制公文并行，不覆盖；普通来信8周无人选择则属员留卷、无奖励，案卷保留到结案或交接。
- [x] 新建`src/office-stories-view.js`，在通判导航加入可见剧情和案件页，接入`src/app.js`的操作。
- [x] 重写通判8条主线叙述，保留选项既有数值与法律责任；回执记录实际效果与延迟回报。
- [x] 运行新增用例与`tests/prefecture.test.js`。

## 2. 同知

- [x] 同知追加同等案件流程测试，验证河工和旧任快照不受新模块影响。
- [x] 新建`src/tongzhi-stories.js`，接入18事件4案，重写同知8条主线；独立内容页沿用共同视图。
- [x] 执行`node --test tests/office-stories.test.js tests/tongzhi.test.js`。

## 3. 知府与跨任承接

- [x] 知府追加旧2案兼容和新4案流程测试；检查同一来源在同次仕途不重用。
- [x] 新建`src/zhifu-stories.js`，接入18事件4案与8条主线重写；原有2案仍按原模块办理。
- [x] 主线显示前任留档中的人情和实际交接结果；结局回访读取已办事件、已结案与设施状态。
- [x] 执行`node --test tests/office-stories.test.js tests/zhifu.test.js`。

## 4. 全任、迁移与交付

- [x] 运行常例/严苛多个种子的完整三任模拟：每周JSON往返`validateSave`，完成所有54事件12案，检查各事件一次、每案一次、原24主线记录、源篇不重复、无触发覆盖。
- [x] 覆盖v11未来窗口和临任末迁移，不补发过去事件，不改变旧案和历史考绩。验证修改计数、伪造证据、到期周、重复队列与重复收益均拒绝。
- [x] 执行`npm test`和`npm run test:release`，检查源与dist同步。
- [x] 本地HTTP启动，通过应用内浏览器完成三任剧情、各一个完整来源案、错误处置退回、来源显示、读档、320/390/桌面布局与控制台检查。
- [x] 更新README、来源映射、验收说明，记录完成数量、测试范围与未上线状态。

## 自检

每任数量、24主线、取材出处、重复上限、兼容、随机周次碰撞、队列、移动导航与验收均有对应步骤。无需另一次批准，用户已授权按此顺序施工。
