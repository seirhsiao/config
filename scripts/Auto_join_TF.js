/**
 *
 * 自动加入Test Flight, 改自下列
 * Sugre：https://github.com/DecoAri/JavaScript/blob/main/Surge/Auto_join_TF.js
 * Loon:  https://github.com/mw418/Loon/blob/main/script/Auto_join_TF.js
 *        https://gitlab.com/lodepuly/vpn_tool/-/raw/main/Resource/Script/TestFlight/Auto_join_TF.js
 * Quanx：https://github.com/chouchoui/QuanX/blob/master/Scripts/testflight/Auto_join_TF.js
 * 注意:
 * surge 用户请使用原作者的本版，下列针对shadowrocket无法手动填入persistentStore，而改而使用argument替代
 * APP_ID 通过argument传进来，多个以逗号','分隔
 */
const $ = new Env('自动加入TestFlight')
$.isDisableModule = false
!(async () => {
    //ids = $argument || $persistentStore.read('APP_ID')
    ids = $.getdata('APP_ID')
    // console.log('last join ids: ' + ids)
    if ($.isShadowrocket() && $argument) {
        ids = ids ? $argument + ',' + ids : $argument
    }
    // console.log('after merge join ids: ' + ids)
    let account_id = $.getdata('account_id')
    let testurl =
        'https://testflight.apple.com/v3/accounts/' + account_id + '/ru/'
    let header = {
        'X-Session-Id': `${$.getdata('session_id')}`,
        'X-Session-Digest': `${$.getdata('session_digest')}`,
        'X-Request-Id': `${$.getdata('request_id')}`,
        'User-Agent': `${$.getdata('tf_ua')}`
    }
    if (ids == '') {
        $.isDisableModule = true
        $.msg($.name, '请先指定需要加入测试的应用, 并重新打开模块')
        // $.msg('所有TF已加入完毕', '请手动禁用该模块', '')
        return
    } else {
        // 去除重复的app id
        let arr = unique(ids.split(','))
        let appIds = arr.join(',')
        if (!isEmpty(appIds)) {
            $.setdata(appIds, 'APP_ID')
        }
        //await arr.map(async (id) => await autoPost(id))
        for await (const id of arr) {
            await autoPost(id)
        }
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
            Object.prototype.toString.call(obj).toLowerCase() ==
                '[object object]'
        ) {
            obj = JSON.stringify(obj)
            return obj === '{}'
        } else if (obj === undefined) {
            return true
        } else {
            return false
        }
    }
    // 去除重复和移除 false, 0, "", null, undefined, NaN
    function unique(arr) {
        return Array.from(new Set(arr)).filter((a) => a)
    }
    function remove(appId) {
        let oldIds = $.getdata('APP_ID')
        let newIds = oldIds
            .split(',')
            .filter((id) => id !== appId)
            .join(',')
        $.setdata(newIds, 'APP_ID')
        // if (!isEmpty(appIds)) {
        //    $.setdata(appIds, 'APP_ID')
        // }
    }
    function accept(id) {
        return $.post(
            {
                url: testurl + id + '/accept',
                headers: header
            },
            (error, resp, body) => {
                let jsonBody = JSON.parse(body)
                $.msg(jsonBody.data.name, 'TestFlight加入成功', '')
                console.log(jsonBody.data.name + 'TestFlight加入成功')
                if (jsonBody.data.name) {
                    remove(id)
                }
            }
        )
    }

    function autoPost(id) {
        return new Promise((resolve) => {
            $.get({url: testurl + id, headers: header}, (error, resp, data) => {
                if (error === null) {
                    if (resp.status == 404) {
                        remove(id)
                        console.log(id + ' ' + '不存在该TF，已自动删除该APP_ID')
                        $.msg(id, '不存在该TF', '已自动删除该APP_ID')
                    } else if (resp.status == 401) {
                        console.log('TF获取信息失败，请从新获取！')
                        $.msg('授权已失效', '请从新使用', 'TF获取信息获取')
                    } else {
                        let jsonData = JSON.parse(data)
                        if (jsonData.data == null) {
                            let message =
                                (jsonData.messages &&
                                    jsonData.messages[0] &&
                                    jsonData.messages[0].message) ||
                                '名额已满'
                            console.log(id + ' ' + message)
                            // console.log(id + ' ' + jsonData.messages[0].message)
                        } else if (jsonData.data.status == 'FULL') {
                            let message = jsonData.data.message || '名额已满'
                            console.log(id + ' ' + message)
                            // console.log(id + ' ' + jsonData.data.message)
                        } else {
                            accept(id)
                        }
                    }
                } else {
                    if (error == 'The request timed out.') {
                        console.log('The request timed out.')
                    } else {
                        $.msg('自动加入TF', error, '')
                        console.log(id + ' ' + error)
                    }
                }
                resolve()
            })
        })
    }
})()
    .catch((e) => $.logErr(e))
    .finally(() => {
        if (
            $.isDisableModule &&
            $.isSurge() &&
            !$.isLoon() &&
            !$.isShadowrocket() &&
            !$.isStash()
        ) {
            $.done(
                // #!name=自动加入TestFlight
                // #!desc=xxx
                $httpAPI('POST', '/v1/modules', {
                    // 'Auto module for JavaScripts': 'false'
                    '自动加入TestFlight': 'false'
                })
            )
        } else {
            $.done()
        }
    })
// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,a]=i.split("@"),n={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),a=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:i,response:r}=t;e(i,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let i=require("iconv-lite");this.initGotEnv(t);const{url:r,...o}=t;this.got[s](r,o).then(t=>{const{statusCode:s,statusCode:r,headers:o,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:s,response:r}=t;e(s,r,r&&i.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,i=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":i}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),this.isSurge()||this.isQuanX()||this.isLoon()?$done(t):this.isNode()&&process.exit(1)}}(t,e)}
