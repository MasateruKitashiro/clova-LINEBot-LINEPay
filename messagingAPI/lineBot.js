'use strict';

const line = require('@line/bot-sdk');
const jsonData = require('../data.json');
const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || 'test',
    channelSecret: process.env.CHANNEL_SECRET || 'test'
};

const client = new line.Client(config);

module.exports = async( req, res ) => {
  Promise
    .all(req.body.events.map(await handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(200).end();
    });
};

// event handler
async function handleEvent(event, session) {
  console.log(event);
  let echo = [];
  const planDataKey = datastore.key(['planData', event.source.userId]);
  
  if (event.type === 'message') {
    if (event.message.text.substring(0, 5) === 'お申し込み') {
      // get Datasore data
      const query = datastore.createQuery('planData').filter('userId', '=', event.source.userId);
      const [planData] = await datastore.runQuery(query);
      var price = '';
      for (const plan of planData) {
        price = plan.planPrice
        console.log(price);
      }
      
      if(price === ''){
        echo = { "type": "text", "text": "申し訳ありませんが、お返事できません。" }; 
      } else{
        // 申し込み内容確認のflex
        echo = {
          "type": "flex",
          "altText": "購入内容を送信しました。",
          "contents": {
            "type": "carousel",
            "contents": [
              {
                "type": "bubble",
                "size": "micro",
                "header": {
                  "type": "box",
                  "layout": "vertical",
                  "contents": [
                    {
                      "type": "text",
                      "text": "お支払い代金"
                    }
                  ]
                },
                "body": {
                  "type": "box",
                  "layout": "vertical",
                  "contents": [
                    {
                      "type": "text",
                      "text": price
                    }
                  ]
                },
                "footer": {
                  "type": "box",
                  "layout": "vertical",
                  "spacing": "sm",
                  "contents": [
                    {
                      "type": "button",
                      "style": "primary",
                      "action": {
                        "type": "uri",
                        "label": "お支払い",
                        "uri": "https://liff.line.me/" + process.env.LINEPAY_LIFF_ID + "?userid=" + event.source.userId
                      }
                    }
                  ]
                },
                "styles": {
                  "header": {
                    "backgroundColor": "#00ffff"
                  }
                }
              }
            ]
          }
        }
      }
    } else {
      echo = { "type": "text", "text": "申し訳ありませんが、お返事できません。" }; 
    }
  } else if (event.type === 'follow') {
    echo = { "type": "text", "text": "オリジナル商品販売スキルを起動してください。カフェマエマエで販売している商品を提案します。" }
    
  } else if(event.type === 'postback'){
    // 埋め込みデータ取得
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');
    const result = data.get('result');
    const goods = data.get('goods');
    // 商品購入（選択）
    if (action === 'select') {
      const selData = jsonData[goods].filter(p => p.id == data.get('planId'))[0];
      console.log(selData); 
      
      // Prepares the new entity
      const planData = {
        key: planDataKey,
        data: {
          userId: event.source.userId,
          planId: selData.id,
          planName: selData.name,
          planImageUrl: selData.goodsImageUrl,
          planPrice: selData.price,
        },
      };
     
      // Saves the entity
      await datastore.save(planData);
      
      echo = {
        "type": "flex",
        "altText": "購入内容を送信しました。",
        "contents": {
          "type": "carousel",
          "contents": [
            {
              "type": "bubble",
              "size": "micro",
              "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                  {
                    "type": "text",
                    "text": "ご購入の商品"
                  }
                ]
              },
              "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                  {
                    "type": "text",
                    "text": selData.name
                  }
                ]
              },
              "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                  {
                    "type": "button",
                    "style": "primary",
                    "action": {
                      "type": "uri",
                      "label": "購入情報入力",
                      "uri": "https://liff.line.me/" + process.env.INFO_LIFF_ID
                    }
                  }
                ]
              },
              "styles": {
                "header": {
                  "backgroundColor": "#00ffff"
                }
              }
            }
          ]
        }
      }
    // クイックリプライ
    } else if (action === 'questionnaire') {
      if (result === 'yes') {
        echo = [
          { "type": "text", "text": "ありがとうございました。次回ご来店時にプレゼントがもらえるクーポンを差し上げます。ご利用ありがとうございました。" },
          {
            "type": "flex",
            "altText": "クーポンを送りました。",
            "contents": {
              "type": "bubble",
              "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                  {
                    "type": "text",
                    "text": "クーポン",
                    "size": "xl"
                  },
                  {
                    "type": "text",
                    "text": "本日のお会計10%オフ！",
                    "size": "xl",
                    "weight": "bold"
                  },
                  {
                    "type": "text",
                    "text": "お支払い時にスタッフにお見せください。",
                    "weight": "bold",
                    "color": "#ff0000"
                  },
                  {
                    "type": "text",
                    "text": "＊本日のみ利用可能です。"
                  }
                ]
              }
            }
          }
        ];
      } else if (result === 'no') {
        echo = { "type": "text", "text": "申し訳ありませんでした。改善に努めます。ご利用ありがとうございました。" }; 
      } else {
        echo = { "type": "text", "text": "申し訳ありませんが、お返事できません。" }; 
      }
    // リッチメニューの切り替え
    } else if(action === 'campaign'){
      if(goods === 'parker'){
        client.linkRichMenuToUser(event.source.userId, process.env.tshirt_RICHMENU_ID);
        return;
      } else if(goods === 'tshirt'){
        client.linkRichMenuToUser(event.source.userId, process.env.parker_RICHMENU_ID);
        return;
      }
    } else {
      echo = { "type": "text", "text": "申し訳ありませんが、お返事できません。" }; 
    }
  } else {
    echo = { "type": "text", "text": "申し訳ありませんが、お返事できません。" }; 
  }

  // use reply API
  return client.replyMessage(event.replyToken, echo);
}
