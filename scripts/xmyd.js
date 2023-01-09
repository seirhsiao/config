/*
小米运动修改微信支付宝运动步数
步骤：

1. 注册小米运动账号，有账号且已绑定微信，支付宝，请跳过
1.1 APP Store下载小米运动APP
1.2 登入小米运动(登录方式必须是手机号码+密码(没有就用手机号码注册),下面的第三方账号(小米账号,Apple,微信)授权登录不行)
1.2 登录成功后在 我的->第三方接入->绑定支付宝，微信


2. 订阅boxjs，https://raw.githubusercontent.com/seirhsiao/config/main/scripts/hsiao.boxjs.json
进入boxjs中，应用中找到对应作者名下的应用（小米运动）应用填入， 输入账号，密码，步数
单账号：
账号：13800138000
密码：abc123qwe

多账户(用不上请忽略)
多账户请用#分割
例如
账号：13800138000#13800138001
密码：abc123qwe#abcqwe2

步数填写规则：
随机步数：1000-2000
固定步数：1234

原生API/云函数API：
原生API - 是原始的小米运动请求，
云函数API - 是收集互联网已经提供了刷步数的API
如果原生API刷步失败可切换至云函数API，尝试

3. 在代理app中，找到对应按照下列填入对应的位置

Surge/ShadowRocket
[Script]
## 小米运动获取Token（可选） 需要打开小米运动app，获取token，用于在boxjs不填入账号，密码，只用于单账户获取token
# 小米运动获取Token = type=http-response, pattern=^https:\/\/account\.huami\.com\/v2\/client\/login, requires-body=1, max-size=0, script-path=https://raw.githubusercontent.com/seirhsiao/config/main/scripts/xmyd.js

小米运动 = type=cron, cronexp="15 17 * * *", timeout=3600, script-path=https://raw.githubusercontent.com/seirhsiao/config/main/scripts/xmyd.js

QuantumultX
[task_local]
# 小米运动
15 17 * * * https://raw.githubusercontent.com/seirhsiao/config/main/scripts/xmyd.js, tag=小米运动, img-url=http://ox.xmkczs.com/quantumultX/xmbs.png, enabled=true

Loon
[Script]
cron "15 17 * * *" script-path=https://raw.githubusercontent.com/seirhsiao/config/main/scripts/xmyd.js, tag=小米运动
 */
const $ = new Env('小米运动')
const DEFAULT_STEP_SIZE = '20000-25000'

// 获取环境变量
const config = {
    username: $.isNode()
        ? process.env.XIAOMI_AMAZFIT_USERNAME
        : $.getdata('XIAOMI_AMAZFIT_USERNAME'),
    password: $.isNode()
        ? process.env.XIAOMI_AMAZFIT_PASSWORD
        : $.getdata('XIAOMI_AMAZFIT_PASSWORD'),
    // user_id: $.isNode() ?process.env.XIAOMI_AMAZFIT_USER_ID :  $.getdata('XIAOMI_AMAZFIT_USER_ID'),
    login_token: $.isNode()
        ? process.env.XIAOMI_AMAZFIT_LOGIN_TOKEN
        : $.getdata('XIAOMI_AMAZFIT_LOGIN_TOKEN'),
    step_size:
        ($.isNode()
            ? process.env.STED_SIZE_RANGE
            : $.getdata('STED_SIZE_RANGE')) ?? DEFAULT_STEP_SIZE,
    is_cloud_api: $.isNode()
        ? process.env.IS_CLOUD_API
        : $.getdata('IS_CLOUD_API')
}
const headers = {
    'Accept': 'application/json, text/plain, */*',
    'app_name': 'com.huami.webapp',
    'Origin': 'https://user.huami.com',
    'Connection': 'keep-alive',
    'Referer': 'https://user.huami.com/',
    // 'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 9; MI 6 MIUI/20.6.18)'
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.0.1; Scale/2.00)'
}

const isRequest = typeof $request != 'undefined'

!(async () => {
    isRequest ? getToken() : await start(config)
})()
    .catch((e) => $.logErr(e))
    .finally(() => $.done())

/**
 * 1、获取access_code
 * 2、执行登陆
 * 3、获取app_token
 * 4、获取淘宝的时间戳
 * 5、修改步数
 * @param {*} config 配置表
 */
async function start(config) {
    let is_cloud_api = config.is_cloud_api
    if (is_cloud_api == 'true') {
        await call_api(config)
    } else {
        if (isEmpty(config.login_token)) {
            $.log('未获取到LOGIN_TOKEN将使用账号密码方式运行')
            await run_with_login(config)
        } else {
            console.log('将使用LOGIN_TOKEN方式运行')
            await run_with_token(config)
        }
    }
}
async function call_api(config) {
    let user_pwd_list = get_user_pwd_list(config)
    for (let user_pwd of user_pwd_list) {
        let step = get_ramdom_step(config.step_size)
        const [username, password] = user_pwd
        // console.log(`username: ${username} - password:${password}`);
        let options = kit9(username, password, step)
        let result = await call_remote(options)
        if (result.code != 200) {
            options = leafone(username, password, step)
            result = await call_remote(options)
        }
        $.msg($.name, `账号：${username}\n步数：${step}`, `${result.msg}`)
        // $.msg($.name, `${message}`, `${msg}`)
    }
}

function call_remote(options) {
    // let api_name = options.url.match(/(?<=\.).*?(?=\.)/)[0] // safari不支持
    let api_name = options.url.match(/^http(s)?:\/\/(.*?)\//)[2]
    return new Promise((resolve, reject) => {
        $.post(options, (err, resp, data) => {
            try {
                if (err) {
                    console.log(`${JSON.stringify(err)}`)
                    console.log('请求${api_name} API失败，请检查网路重试')
                    reject(new Error(err))
                } else {
                    resolve(get_result(data))
                }
            } catch (e) {
                console.log('请求${api_name} API失败发生错误，请检查日志')
                $.logErr(e, resp)
                reject(new Error('请求${api_name} API失败发生错误，请检查日志'))
            }
        })
    })
}
// {"code":200,"msg":"success","data":{"state":"13588步已上传到云端,请稍后查看是否已经成功同步,如未同步请联系网站管理员反馈！"}}
function kit9(username, password, step) {
    let email = toUrlEncode({
        email: username,
        password: password,
        step: step
    })

    let phone = toUrlEncode({
        phone: username,
        password: password,
        step: step
    })

    let is_email = username.indexOf('@') > -1
    let data = is_email ? email : phone
    let options = {
        url: is_email
            ? 'https://api.kit9.cn/api/xiaomi_sports/api_email_fixed.php'
            : 'https://api.kit9.cn/api/xiaomi_sports/api_phone_fixed.php',
        body: `${data}`,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        }
    }
    return options
}

function leafone(username, password, step) {
    let data = toUrlEncode({
        user: username,
        password: password,
        step: step
    })
    let options = {
        url: 'https://api.leafone.cn/api/mi',
        body: `${data}`,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        }
    }
    return options
}

function get_result(data) {
    //  console.log(`${JSON.stringify(data)}`)
    let result = {
        code: 200,
        msg: '提交步数成功🎉'
    }
    if (data) {
        data = JSON.parse(data)
        let status = data.code
        if (status == 200) {
            return result
        } else if (status == 201 || status == 207) {
            result.msg = '账号或者密码错误'
        } else {
            result.code = -3
            result.msg = '提交步数失败'
        }
    } else {
        result.code = 500
        result.msg = '服务器繁忙，请稍后再试'
    }
    return result
}

// 打开小米运动获取login_token，用于在boxjs不填入账号，密码
function getToken() {
    if ($response.body) {
        const body = JSON.parse($response.body)
        const loginToken = body.token_info.login_token
        $.log(`${$.name}token\n${loginToken}\n`)
        if ($.getdata('XIAOMI_AMAZFIT_LOGIN_TOKEN')) {
            $.msg($.name, '更新Token: 成功🎉', ``)
        } else {
            $.msg($.name, '获取Token: 成功🎉', '')
        }
        $.setdata(loginToken, 'XIAOMI_AMAZFIT_LOGIN_TOKEN')
    }
    $.done({})
}

async function run_with_token(config) {
    let login_token = config.login_token
    let login_token_list = [login_token]
    if (login_token.includes(',')) {
        login_token_list = login_token.split(',')
    }
    for (let login_token of login_token_list) {
        let step = get_ramdom_step(config.step_size)
        if (login_token) {
            const token_info = await get_app_token(login_token)
            // console.log(`token_info: ${JSON.stringify(token_info)}`)
            if (!isEmpty(token_info)) {
                const {app_token, user_id} = token_info
                await push_band_data(step, user_id, app_token)
            }
        }
    }
}

async function run_with_login(config) {
    let user_pwd_list = get_user_pwd_list(config)
    // console.log(user_pwd_list)
    let arr = []
    for (let user_pwd of user_pwd_list) {
        let step = get_ramdom_step(config.step_size)
        const [username, password] = user_pwd
        // console.log(`username: ${username} - password:${password}`);
        const access_code = await login(username, password)
        if (isEmpty(access_code)) {
            $.log(`${username} 登录获取授权码失败，请稍后再试！`)
            // throw new Error('获取登录授权码失败')
            continue
        }
        let type = username.indexOf('@') > -1 ? 1 : 0
        const token_info = await get_app_token(access_code, type)
        // console.log(`token_info: ${JSON.stringify(token_info)}`)
        if (!isEmpty(token_info)) {
            const {app_token, login_token, user_id} = token_info
            if (login_token) {
                arr.push(login_token)
            }
            await push_band_data(step, user_id, app_token)
        }
    }
    if (arr.length > 0) {
        let login_token = arr.join(',')
        $.setdata(login_token, 'XIAOMI_AMAZFIT_LOGIN_TOKEN')
        $.msg($.name, '更新Token: 成功🎉', ``)
        console.log(`login_token: ${login_token}`)
    }
}

function get_user_pwd_list(config) {
    let username = config.username
    let password = config.password

    let user_pwd_list = []
    if (username.includes('#') && password.includes('#')) {
        let user_list = username.split('#')
        let passwd_list = password.split('#')
        if (user_list.length == passwd_list.length) {
            user_pwd_list = user_list.map((e, i) => {
                return [e, passwd_list[i]]
            })
        } else {
            // $.msg($.name, '用户名和密码数量不对', '')
            console.log('用户名和密码数量不对')
        }
    } else {
        user_pwd_list = [[username, password]]
    }
    return user_pwd_list
}
function get_app_token(token = null, type = null) {
    if (type !== null) {
        return get_app_token_by_code(token, type)
    } else {
        return get_app_token_by_login(token)
    }
}

// git token_info by login_token
function get_app_token_by_login(login_token) {
    let headers = get_headers()
    return new Promise((resolve, reject) => {
        $.get(
            {
                url: `https://account-cn.huami.com/v1/client/app_tokens?app_name=com.xiaomi.hm.health&dn=api-user.huami.com%2Capi-mifit.huami.com%2Capp-analytics.huami.com&login_token=${login_token}`,
                headers
            },
            (err, resp, data) => {
                try {
                    if (err) {
                        console.log(`${JSON.stringify(err)}`)
                        console.log(`${$.name} API请求失败，请检查网路重试`)
                    } else {
                        // 获取token_info
                        resolve(get_token_info(data))
                    }
                } catch (e) {
                    console.log('获取token_info发生错误，请检查日志')
                    $.logErr(e, resp)
                    reject(new Error('获取token_info发生错误，请检查日志'))
                }
            }
        )
    })
}

// get token_info by access code
function get_app_token_by_code(code, type) {
    let headers = get_headers()
    let data = toUrlEncode({
        app_name: 'com.xiaomi.hm.health',
        app_version: '6.3.5',
        code: code,
        country_code: 'CN',
        device_id: 'device_id_type=uuid',
        dn: 'api-user.huami.com%2Capi-mifit.huami.com%2Capp-analytics.huami.com',
        device_model: 'phone',
        grant_type: 'access_token',
        lang: 'zh_CN',
        os_version: '1.5.0',
        source: 'com.xiaomi.hm.health',
        third_name: type == 0 ? 'huami_phone' : 'email',
        allow_registration: false
    })
    let options = {
        url: 'https://account.huami.com/v2/client/login',
        body: `${data}`,
        headers: headers
    }
    return new Promise((resolve, reject) => {
        $.post(options, (err, resp, data) => {
            try {
                if (err) {
                    console.log(`${JSON.stringify(err)}`)
                    console.log('获取token_info失败，请检查网路重试')
                    reject(new Error(err))
                } else {
                    // 获取token info
                    resolve(get_token_info(data))
                }
            } catch (e) {
                console.log('获取token_info发生错误，请检查日志')
                $.logErr(e, resp)
                reject(new Error('获取token_info发生错误，请检查日志'))
            }
        })
    })
}
function get_token_info(data) {
    let token_info = {}
    if (data) {
        // console.log(data)
        data = JSON.parse(data)
        if (data.result === 'ok') {
            token_info = data.token_info
            console.log('获取app_token成功')
            // console.log(`获取app_token成功 token: ${token_info.app_token}`)
        }
    }
    return token_info
}

function login(username, password) {
    let headers = get_headers()
    let isEmail = username.indexOf('@') > -1
    let data = toUrlEncode({
        client_id: 'HuaMi',
        country_code: 'zh-CN',
        json_response: true,
        name: username,
        password: password,
        redirect_uri:
            'https://s3-us-west-2.amazonaws.com/hm-registration/successsignin.html',
        state: 'REDIRECTION',
        token: 'access'
    })
    let options = {
        url:
            'https://api-user.huami.com/registrations/' +
            (isEmail ? '' : '+86') +
            username +
            '/tokens',
        body: `${data}`,
        headers: headers
    }
    return new Promise((resolve, reject) => {
        $.post(options, (err, resp, data) => {
            try {
                if (err) {
                    console.log(`${JSON.stringify(err)}`)
                    console.log('登录失败， 请检查账号密码')
                    reject(new Error(err))
                } else {
                    // $.log(`get access code data: ${data}`)
                    // $.log('登录成功, 开始获取登录授权码')
                    // 获取Code
                    resolve(get_code(data))
                }
            } catch (e) {
                console.log('获取登录授权码发生错误，请检查日志')
                $.logErr(e, resp)
                reject(new Error('获取登录授权码发生错误，请检查日志'))
            }
        })
    })
}

function get_code(data) {
    let code = ''
    if (data) {
        // console.log(data)
        data = JSON.parse(data)
        if (data.ok) {
            code = data.access
            console.log('获取登录授权码成功')
            // console.log(`获取登录授权码成功 code: ${code}`)
        }
    }
    return code
}

async function push_band_data(step, user_id, app_token) {
    let timestamp = new Date().getTime()
    const data = toUrlEncode({
        userid: user_id,
        // last_sync_data_time: 1597306380,
        last_sync_data_time: Math.floor(timestamp / 1000),
        device_type: 0,
        //last_deviceid = 'FC30D8FFFE3E028A',
        last_deviceid: 'DA932FFFFE8816E7',
        data_json: await build_data_json(step)
    })
    let options = {
        url: `https://api-mifit-cn.huami.com/v1/data/band_data.json?&t=${Date.now()}`,
        body: `${data}`,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'X-FORWARDED-FOR': randomIp(),
            'CLIENT-IP': randomIp(),
            'apptoken': app_token
        }
    }
    return new Promise((resolve, reject) => {
        $.post(options, (err, resp, data) => {
            try {
                if (err) {
                    console.log(`${JSON.stringify(err)}`)
                    console.log('上传步数失败，请检查网路重试')
                    reject(new Error(err))
                } else {
                    if (data) {
                        data = JSON.parse(data)
                        // console.log(`${JSON.stringify(data)}`)
                        if (data.message == 'success') {
                            // console.log(`上传步数成功 step：${step}`)
                            $.msg(
                                $.name,
                                `账号：${user_id}`,
                                `步数：${step} 修改成功`
                            )
                        }
                    }
                    resolve()
                }
            } catch (e) {
                console.log('上传步数发生错误，请检查日志')
                $.logErr(e, resp)
                reject(new Error('上传步数发生错误，请检查日志'))
            }
        })
    })
}

//需要修改的运动步数波动范围，脚本默认修改步数范围为1w9到2w5
function get_ramdom_step(step_size = DEFAULT_STEP_SIZE) {
    if (isEmpty(step_size)) {
        step_size = DEFAULT_STEP_SIZE
    }
    // 固定步数
    if (!step_size.includes('-')) {
        return parseInt(step_size)
    }

    // 随机步数
    const temp = step_size.split('-')
    if (temp.length !== 2) return get_ramdom_step()

    const min = new Number(temp[0])
    const max = new Number(temp[1])
    const step = parseInt(min + Math.random() * (max - min))
    console.log(`在 [${min} 至 ${max}] 范围内随机步数 step: ${step}`)
    return step
}

function build_data_json(step) {
    const time = timeFormat(localtime())
    let data_json = [
        {
            summary:
                '{"slp":{"ss":73,"lt":304,"dt":0,"st":1589920140,"lb":36,"dp":92,"is":208,"rhr":0,"stage":[{"start":269,"stop":357,"mode":2},{"start":358,"stop":380,"mode":3},{"start":381,"stop":407,"mode":2},{"start":408,"stop":423,"mode":3},{"start":424,"stop":488,"mode":2},{"start":489,"stop":502,"mode":3},{"start":503,"stop":512,"mode":2},{"start":513,"stop":522,"mode":3},{"start":523,"stop":568,"mode":2},{"start":569,"stop":581,"mode":3},{"start":582,"stop":638,"mode":2},{"start":639,"stop":654,"mode":3},{"start":655,"stop":665,"mode":2}],"ed":1589943900,"wk":0,"wc":0},"tz":"28800","stp":{"runCal":1,"cal":6,"conAct":0,"stage":[],"ttl":' +
                step +
                ',"dis":144,"rn":0,"wk":5,"runDist":4,"ncal":0},"v":5,"goal":8000}',
            data: [
                {
                    stop: 1439,
                    value: 'WhQAUA0AUAAAUAAAUAAAUAAAUAAAWhQAUAYAcBEAUAYAUA8AUAsAUAYAUDIAUCQAUDkAUCkAUD4AUC0AUFcAUD8AUCkAUCEAUCwAUCsAUB4AUCQAUBsAUCcAUBQAUDcAUBoAUCYAUFcAUCAAUDkAUCEAWhQAWhQAWhQAUBAAUEgAUDsAUAgAWhQAUDwAUCEAUAIAUAsAUDoAUD8AWhQAWhQAWhQAWhQAWhQAWhQAAS0QEAsAWhQAAR8SEBcHYC4AUCoAUBMAUAIAUAYAUAsAUCsAUAUAUBIAUBIAUBsAUBgAUAoAUBsAUBUAUBkAUDIAUC0AUC4AUBAAWhQAUCsAUB8AUAIAUB8AUDUAUEEAUDUAUBkAUCYAUEoAUCYAUBIAUCAAUCkAUDAAUB4AUB0AUDEAUCUAUCgAUAQAWhQAUA8AUDwAUB8AUCUAUBQAUB4AUAUAWhQAUAAAUA8AUBkAUCgAUCwAUCkAUCgAYCIAYCIAYCgAUAoAWhQAUBwAWhQAUBoAUDkAUD4AYAkAYAYAWhQAWhQAUB4AWhQAUAQAUBcAUBAAUAUAWhQAUB0AcBYAehQAcBoAehQAehQAehQAcAMAcAMAehQAcAIAehQAcBIAcA0AehQAehQAcAsAcAYAcAEAcAoAehQAehQAcAwAehQAehQAehQAcAEAehQAehQAcAsAehQAehQAcA8AcBkAcAYAcBkAcC0AcAQAcBsAcAMAWhQAUAMAWhQAUBEAUAIAWhQAWhQAWhQAehQAehQAehQAehQAehQAehQAcAAAcB8AcBMAehQAehQAcDkAcBAAcAEAcAMAcAMAcCwAcA8AcAAAcAAAcCIAcAAAcCcAcB4AehQAcAkAehQAcCMAehQAehQAcAoAehQAehQAehQAcBgAcBgAcAkAehQAcAcAcCgAcBQAcA0AcAwAcCcAcCkAcAAAUAAAUAAAUB4AUBwAUAAAUAAAUCkAUBIAUBMAUCgAUA8AUBEAUD0AUCAAYAMAYCkAUBsAUB4AYCgAahQAUBkAWhQAWhQAUCAAUBcAUA8AUBAAUAcAUB8AUCEAUCMAUCkAYAMAYAAAUBsAUBEAUBgAUAUAUB0AUAAAUAAAUAAAUAAAUAAAUAQAUAAAUAAAUAAAUAAAWwAAUAAAcAAAcAAAcAAAcAAAcAAAcAAAcA0AcAAAcAAAcAAAcAIAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcA8AehQAehQAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAEAeRMAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAsAcAAAcAAAcAAAcAAAcAAAcAoAcAAAcBMAcAAAcAAAcAAAcAAAcAAAcAAAcA4AcAcAehQAehQAcAAAcAAAcAIAehQAehQAcAAAcAAAcAAAcAAAcAAAcAIAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBcAehQAehQAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAehQAcAMAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBUAeQAAcAAAcAAAcAAAcFgAcAAAcAAAcAAAcBkAeQAAcAAAcAAAcAAAcAAAcE0AcAQAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAeVAAehQAehQAcAAAcAAAcAAAcAAAcAUAeRwAUAAAUFUAUAAAUAAAUAAAUAAAUAAAUCMAeQAAcAAAcAAAcE0AUAAAUAAAUAAAUAAAUAAAUAAAcAAAcAAAcAAAcE4AcAAAcAAAcAAAcAAAcAgAcBAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAkAcAAAcAAAcAAAcAAAcBwAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAYAcBAAeQAAcB8AeQAAcAAAcAAAcAAAeSoAcAAAcAAAcAAAcAAAcAAAcAsAcAAAeScAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcCAAcAAAUAAAUAAAUAAAUAAAUAAAUBEAehQAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBwAehQAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBYAcAAAcAAAcAAAcAYAcAAAcAAAcCsAcAAAcAAAcAgAcAAAcAAAcBsAeRQAcAAAcAAAcAEAcAAAcAAAcAAAcAAAcAAAcAAAcA8AcAAAcAAAcBoAcAAAcAEAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAQAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBIAcAAAcA0AcBAAcAAAcAAAcAAAcAAAehQAehQAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcCgAcAAAcBkAcAAAcB0AcAAAcAAAcBgAcAAAUAEAUBsAWhQAUB4AWhQAUCkAWQ8AUCsAUA0AWTUAXBAAWhQAUBMAUAQAUAcAUAoAUA8AUBkAUBcAUCoAUAIAUBQAWhQAWhQAUBIAUBQAUAcAWhQAUBYAWhQAUAgAWhQAWhQAUAkAUE0AUHUAAWMTEEcKYDoAYAgAUAMAWhQAUAUAUAYAUAkAUB4AUAsAUAIAUBMAWhQAAVQdAWAlEDYAYCQAUAQAUBgAUAgAUAUAUBQAUAIAWhQAUAkAUAMAUA4AWhQAehQAcAoAcAIAehQAcB0AcCcAUCsAUAEAUAgAUAoAUAIAUAsAUAIAWhQAWhQAUAgAUA0AWhQAUAYAWhQAUAEAWhQAWhQAUBAAUBQAUBIAUBcAUAoAYBAAYAIAAUkZAUglAVYSYBcAYAoAYCAAYAsAUBUAUB0AUBAAUBEAUCAAUBUAUBYAUA0AUB4AUBcAUBsAUBMAUBUAYAsAYAwAYAsAUB4AUBoAUBoAUBoAUBQAUAcAWhQAUBgAUBkAUBsAUBUAUBAAUCAAUCYAUB8AUB4AUBwAUAcAUBsAUBwAUBwAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAA',
                    did: 'DA932FFFFE8816E7',
                    tz: 32,
                    src: 17,
                    start: 0
                }
            ],
            data_hr:
                '/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+',
            summary_hr: '{"ct":0,"id":[]}',
            date: time
        }
    ]
    return JSON.stringify(data_json)
}

//获取时间戳精确到毫秒
// {"api":"mtop.common.getTimestamp","v":"*","ret":["SUCCESS::接口调用成功"],"data":{"t":"1673004494820"}}
function get_time() {
    return new Promise((resolve, reject) => {
        $.get(
            {
                url: `http://api.m.taobao.com/rest/api3.do?api=mtop.common.getTimestamp`
            },
            (err, resp, data) => {
                try {
                    if (err) {
                        console.log(`${JSON.stringify(err)}`)
                        console.log(`${$.name} API请求失败，请检查网路重试`)
                    } else {
                        //   console.log(data)
                        if (data) {
                            data = JSON.parse(data)
                            //   $.t = data.data.t;
                            resolve(data.data.t)
                        }
                    }
                } catch (e) {
                    console.log('获取淘宝时间发生错误，请检查日志')
                    $.logErr(e, resp)
                    reject(new Error('获取淘宝时间发生错误，请检查日志'))
                }
            }
        )
    })
}

function get_headers() {
    headers['X-FORWARDED-FOR'] = randomIp()
    headers['CLIENT-IP'] = randomIp()
    return headers
}

function randomIp() {
    return Array(4)
        .fill(0)
        .map((_, i) => Math.floor(Math.random() * 255) + (i === 0 ? 1 : 0))
        .join('.')
}

function localtime() {
    return (
        new Date().getTime() +
        new Date().getTimezoneOffset() * 60 * 1000 +
        8 * 60 * 60 * 1000
    )
}
function timeFormat(time) {
    let date
    if (time) {
        date = new Date(time)
    } else {
        date = new Date()
    }
    return (
        date.getFullYear() +
        '-' +
        (date.getMonth() + 1 >= 10
            ? date.getMonth() + 1
            : '0' + (date.getMonth() + 1)) +
        '-' +
        (date.getDate() >= 10 ? date.getDate() : '0' + date.getDate())
    )
}

function toUrlEncode(obj) {
    return Object.keys(obj)
        .map((key) => key + '=' + obj[key])
        .join('&')
}

function isEmpty(obj) {
    if (typeof obj === 'string') {
        return obj.length === 0
    } else if (obj instanceof Array) {
        return obj.length === 0
    } else if (obj instanceof Set) {
        return obj.size === 0
    } else if (obj === null) {
        return true
    } else if (
        typeof obj == 'object' &&
        Object.prototype.toString.call(obj).toLowerCase() == '[object object]'
    ) {
        obj = JSON.stringify(obj)
        return obj === '{}'
    } else if (obj === undefined) {
        return true
    } else {
        return false
    }
}

// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,a]=i.split("@"),n={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),a=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:i,response:r}=t;e(i,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let i=require("iconv-lite");this.initGotEnv(t);const{url:r,...o}=t;this.got[s](r,o).then(t=>{const{statusCode:s,statusCode:r,headers:o,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:s,response:r}=t;e(s,r,r&&i.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,i=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":i}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),this.isSurge()||this.isQuanX()||this.isLoon()?$done(t):this.isNode()&&process.exit(1)}}(t,e)}
