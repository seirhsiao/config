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

3. 在代理app中，找到对应按照下列填入对应的位置

Surge/ShadowRocket
[Script]
小米步数 = type=cron, cronexp="15 17 * * *", timeout=3600, script-path=https://raw.githubusercontent.com/seirhsiao/config/main/scripts/xmbs.js

QuantumultX
[task_local]
# 小米步数
15 17 * * * https://raw.githubusercontent.com/seirhsiao/config/main/scripts/xmbs.js, tag=小米步数, img-url=http://ox.xmkczs.com/quantumultX/xmbs.png, enabled=true

Loon
[Script]
cron "15 17 * * *" script-path=https://raw.githubusercontent.com/seirhsiao/config/main/scripts/xmbs.js, tag=小米步数
 */
const $ = new Env('小米步数')
const DEFAULT_STEP_SIZE = '20000-25000'

获取环境变量
const config = {
    username: $.isNode()
        ? process.env.XIAOMI_AMAZFIT_USERNAME
        : $.getdata('XIAOMI_AMAZFIT_USERNAME'),
    password: $.isNode()
        ? process.env.XIAOMI_AMAZFIT_PASSWORD
        : $.getdata('XIAOMI_AMAZFIT_PASSWORD'),
    step_size:
        ($.isNode()
            ? process.env.STED_SIZE_RANGE
            : $.getdata('STED_SIZE_RANGE')) ?? DEFAULT_STEP_SIZE
}

!(async () => {
    await start(config)
})()
    .catch((e) => $.logErr(e))
    .finally(() => $.done())

async function start(config) {
    let user_pwd_list = get_user_pwd_list(config)
    for (let user_pwd of user_pwd_list) {
        let step = get_ramdom_step(config.step_size)
        const [username, password] = user_pwd
        // console.log(`username: ${username} - password:${password}`);
        let options = kit9(username, password, step)
        //let options = shuabu(username, password, step)
        //let options = ioshkj(username, password, step)
        let result = await call_remote(options)
        if (result.code != 200) {
            options = leafone(username, password, step)
            result = await call_remote(options)
        }
        $.msg($.name, `账号：${username}\n步数：${step}`, `${result.msg}`)
        // $.msg($.name, `${message}`, `${msg}`)
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

function get_result(data) {
    //  console.log(`${JSON.stringify(data)}`)
    let result = {
        code: 200,
        msg: '提交步数成功🎉'
    }
    if (data) {
        data = JSON.parse(data)
        let status = data.code
        if (status == 200 || status == 1) {
            return result
        } else if (status == 201 || status == 207) {
            result.msg = '账号或者密码错误'
        } else {
            result.code = 400
            result.msg = '提交步数失败'
        }
    } else {
        result.code = 500
        result.msg = '服务器繁忙，请稍后再试'
    }
    return result
}

/**
 * https://api.kit9.cn/tool/steps/
 * @param {*} username
 * @param {*} password
 * @param {*} step
 * @returns // {"code":200,"msg":"success","data":{"state":"13588步已上传到云端,请稍后查看是否已经成功同步,如未同步请联系网站管理员反馈！"}}
 */
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

/**
 * https://api.leafone.cn/doc/mi.html
 * @param {*} username
 * @param {*} password
 * @param {*} step
 * @returns // {"code":200,"msg":"步数上传成功！","user":"177********","step":"8214"}
 */
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

/**
 * https://yd.shuabu.net/
 * @param {*} username
 * @param {*} password
 * @param {*} step
 * @returns // {"code":200,"msg":"同步成功"} {"code":-3,"msg":"登录失败，账户或密码错误"}
 */
function shuabu(username, password, step) {
    let time = parseInt(new Date().getTime() / 1000 + '')
    let data = toUrlEncode({
        phone: username,
        password: password,
        step: step,
        time: time,
        key: md5(encode(`${phone}1${password}2${step}xjdsb${time}`))
    })
    let options = {
        url: 'https://api.shuabu.net/apix/xm.php',
        // url: 'https://api.shuabu.net/apimfsb/xm.php',
        body: `${data}`,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        }
    }
    return options
}

/**
 * http://bs.svv.ink/
 * @param {*} username
 * @param {*} password
 * @param {*} step
 * @returns // {"code":1,"message":"success"}
 */
function ioshkj(username, password, step) {
    let data = toUrlEncode({
        account: username,
        password: password,
        steps: step
    })
    let options = {
        url: 'http://bs.svv.ink/index.php',
        body: `${data}`,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        }
    }
    return options
}

function toUrlEncode(obj) {
    return Object.keys(obj)
        .map((key) => key + '=' + obj[key])
        .join('&')
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
function encode(str) {
    const b64ch =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    const b64chs = Array.prototype.slice.call(b64ch)
    let u32,
        c0,
        c1,
        c2,
        asc = ''
    let pad = str.length % 3
    for (let i = 0; i < str.length; ) {
        if (
            (c0 = str.charCodeAt(i++)) > 255 ||
            (c1 = str.charCodeAt(i++)) > 255 ||
            (c2 = str.charCodeAt(i++)) > 255
        )
            throw new TypeError('invalid character found')
        u32 = (c0 << 16) | (c1 << 8) | c2
        asc +=
            b64chs[(u32 >> 18) & 63] +
            b64chs[(u32 >> 12) & 63] +
            b64chs[(u32 >> 6) & 63] +
            b64chs[u32 & 63]
    }
    return pad ? asc.slice(0, pad - 3) + '==='.substring(pad) : asc
}

function md5(s) {
    const chrsz = 8 /* bits per input character. 8 - ASCII; 16 - Unicode      */
    const hexcase = 0 /* hex output format. 0 - lowercase; 1 - uppercase      */
    const hex_md5 = function () {
        return binl2hex(core_md5(str2binl(s), s.length * chrsz))
    }

    /*
     * Convert an array of little-endian words to a hex string.
     */
    const binl2hex = function (binarray) {
        let hex_tab = hexcase ? '0123456789ABCDEF' : '0123456789abcdef'
        let str = ''
        for (let i = 0; i < binarray.length * 4; i++) {
            str +=
                hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) +
                hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xf)
        }
        return str
    }

    const core_md5 = function (x, len) {
        /* append padding */
        x[len >> 5] |= 0x80 << len % 32
        x[(((len + 64) >>> 9) << 4) + 14] = len
        let a = 1732584193
        let b = -271733879
        let c = -1732584194
        let d = 271733878
        for (let i = 0; i < x.length; i += 16) {
            let olda = a
            let oldb = b
            let oldc = c
            let oldd = d
            a = md5_ff(a, b, c, d, x[i + 0], 7, -680876936)
            d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586)
            c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819)
            b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330)
            a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897)
            d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426)
            c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341)
            b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983)
            a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416)
            d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417)
            c = md5_ff(c, d, a, b, x[i + 10], 17, -42063)
            b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162)
            a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682)
            d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101)
            c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290)
            b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329)
            a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510)
            d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632)
            c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713)
            b = md5_gg(b, c, d, a, x[i + 0], 20, -373897302)
            a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691)
            d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083)
            c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335)
            b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848)
            a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438)
            d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690)
            c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961)
            b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501)
            a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467)
            d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784)
            c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473)
            b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734)
            a = md5_hh(a, b, c, d, x[i + 5], 4, -378558)
            d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463)
            c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562)
            b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556)
            a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060)
            d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353)
            c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632)
            b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640)
            a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174)
            d = md5_hh(d, a, b, c, x[i + 0], 11, -358537222)
            c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979)
            b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189)
            a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487)
            d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835)
            c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520)
            b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651)
            a = md5_ii(a, b, c, d, x[i + 0], 6, -198630844)
            d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415)
            c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905)
            b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055)
            a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571)
            d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606)
            c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523)
            b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799)
            a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359)
            d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744)
            c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380)
            b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649)
            a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070)
            d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379)
            c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259)
            b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551)
            a = safe_add(a, olda)
            b = safe_add(b, oldb)
            c = safe_add(c, oldc)
            d = safe_add(d, oldd)
        }
        return Array(a, b, c, d)
    }
    /*
     * These functions implement the four basic operations the algorithm uses.
     */
    const md5_cmn = function (q, a, b, x, s, t) {
        return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b)
    }
    const md5_ff = function (a, b, c, d, x, s, t) {
        return md5_cmn((b & c) | (~b & d), a, b, x, s, t)
    }
    const md5_gg = function (a, b, c, d, x, s, t) {
        return md5_cmn((b & d) | (c & ~d), a, b, x, s, t)
    }
    const md5_hh = function (a, b, c, d, x, s, t) {
        return md5_cmn(b ^ c ^ d, a, b, x, s, t)
    }
    const md5_ii = function (a, b, c, d, x, s, t) {
        return md5_cmn(c ^ (b | ~d), a, b, x, s, t)
    }
    /*
     * Add integers, wrapping at 2^32. This uses 16-bit operations internally
     * to work around bugs in some JS interpreters.
     */
    const safe_add = function (x, y) {
        let lsw = (x & 0xffff) + (y & 0xffff)
        let msw = (x >> 16) + (y >> 16) + (lsw >> 16)
        return (msw << 16) | (lsw & 0xffff)
    }
    /*
     * Bitwise rotate a 32-bit number to the left.
     */
    const bit_rol = function (num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt))
    }
    /*
     * Convert a string to an array of little-endian words
     * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
     */
    const str2binl = function (str) {
        let chrsz = 8 /* bits per input character. 8 - ASCII; 16 - Unicode      */
        let bin = Array()
        let mask = (1 << chrsz) - 1
        for (let i = 0; i < str.length * chrsz; i += chrsz)
            bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << i % 32
        return bin
    }
    return hex_md5(s)
}
// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,a]=i.split("@"),n={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),a=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:i,response:r}=t;e(i,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let i=require("iconv-lite");this.initGotEnv(t);const{url:r,...o}=t;this.got[s](r,o).then(t=>{const{statusCode:s,statusCode:r,headers:o,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:s,response:r}=t;e(s,r,r&&i.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,i=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":i}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),this.isSurge()||this.isQuanX()||this.isLoon()?$done(t):this.isNode()&&process.exit(1)}}(t,e)}
