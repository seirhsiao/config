/**
 *
 * 脚本作者：DecoAri
 * 引用地址：https://github.com/DecoAri/JavaScript/blob/main/Surge/Auto_join_TF.js
 * 注意:
 * surge 用户请使用原作者的本版，下列针对shadowrocket无法手动填入persistentStore，而改而使用argument
 * APP_ID 通过argument传进来，多个以逗号','分隔
 */

!(async () => {
    // ids = $persistentStore.read('APP_ID')
    ids = $argument
    if (ids == '') {
        $notification.post('所有TF已加入完毕', '模块已自动关闭', '')
        $done(
            $httpAPI('POST', '/v1/modules', {
                'Auto module for JavaScripts': 'false'
            })
        )
    } else {
        ids = ids.split(',')
        for await (const ID of ids) {
            await autoPost(ID)
        }
    }
    $done()
})()

function autoPost(ID) {
    let Key = $persistentStore.read('key')
    let testurl = 'https://testflight.apple.com/v3/accounts/' + Key + '/ru/'
    let header = {
        'X-Session-Id': `${$persistentStore.read('session_id')}`,
        'X-Session-Digest': `${$persistentStore.read('session_digest')}`,
        'X-Request-Id': `${$persistentStore.read('request_id')}`
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
                                            ' TestFlight加入成功'
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
