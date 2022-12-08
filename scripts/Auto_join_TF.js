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

!(async () => {
    //ids = $argument || $persistentStore.read('APP_ID')
    ids = $persistentStore.read('APP_ID')
    // console.log('last join ids: ' + ids)
    if ($argument) {
        ids = ids ? $argument + ',' + ids : $argument
    }
    // console.log('after merge join ids: ' + ids)
    if (ids == '') {
        // $notification.post('所有TF已加入完毕', '模块已自动关闭', '')
        $notification.post('所有TF已加入完毕', '请手动禁用该模块', '')
        $done()
        // $done(
        //     $httpAPI('POST', '/v1/modules', {
        //         'Auto module for JavaScripts': 'false'
        //     })
        // )
    } else {
        // 去除重复的app id
        let arr = ids.split(',')
        ids = unique(arr).filter((a) => a)
        try {
            for await (const id of ids) {
                await autoPost(id)
            }
        } catch (error) {
            console.log(error)
            $done()
        }
    }
    $done()
})()

function unique(arr) {
    return Array.from(new Set(arr))
}
function autoPost(ID) {
    let account_id = $persistentStore.read('account_id')
    let testurl = 'https://testflight.apple.com/v3/accounts/' + account_id + '/ru/'
    let header = {
        'X-Session-Id': `${$persistentStore.read('session_id')}`,
        'X-Session-Digest': `${$persistentStore.read('session_digest')}`,
        'X-Request-Id': `${$persistentStore.read('request_id')}`,
        'User-Agent': `${$persistentStore.read('tf_ua')}`
    }
    return new Promise(function (resolve) {
        $httpClient.get(
            {url: testurl + ID, headers: header},
            function (error, resp, data) {
                if (error === null) {
                    if (resp.status == 404) {
                        ids = $persistentStore.read('APP_ID').split(',')
                        ids = ids.filter((ids) => ids !== ID)
                        $persistentStore.write(ids.toString(), 'APP_ID')
                        console.log(ID + ' ' + '不存在该TF，已自动删除该APP_ID')
                        $notification.post(
                            ID,
                            '不存在该TF',
                            '已自动删除该APP_ID'
                        )
                        resolve()
                    } else if (resp.status == 401) {
                        console.log('TF获取信息失败，请从新获取！')
                        $notification.post(
                            '授权已失效',
                            '请从新使用',
                            'TF获取信息获取'
                        )
                        resolve()
                    } else {
                        let jsonData = JSON.parse(data)
                        if (jsonData.data == null) {
                            console.log(ID + ' ' + jsonData.messages[0].message)
                            resolve()
                        } else if (jsonData.data.status == 'FULL') {
                            console.log(ID + ' ' + jsonData.data.message)
                            resolve()
                        } else {
                            $httpClient.post(
                                {
                                    url: testurl + ID + '/accept',
                                    headers: header
                                },
                                function (error, resp, body) {
                                    let jsonBody = JSON.parse(body)
                                    $notification.post(
                                        jsonBody.data.name,
                                        'TestFlight加入成功',
                                        ''
                                    )
                                    console.log(
                                        jsonBody.data.name +
                                            'TestFlight加入成功'
                                    )
                                    ids = $persistentStore
                                        .read('APP_ID')
                                        .split(',')
                                    ids = ids.filter((ids) => ids !== ID)
                                    $persistentStore.write(
                                        ids.toString(),
                                        'APP_ID'
                                    )
                                    resolve()
                                }
                            )
                        }
                    }
                } else {
                    if (error == 'The request timed out.') {
                        resolve()
                    } else {
                        $notification.post('自动加入TF', error, '')
                        console.log(ID + ' ' + error)
                        resolve()
                    }
                }
            }
        )
    })
}
