'use strict';
const clova = require('@line/clova-cek-sdk-nodejs');
const line = require('@line/bot-sdk');
const jsonData = require('../data.json');

// LINE BOTの設定
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || 'test',
    channelSecret: process.env.CHANNEL_SECRET || 'test'
};
const base_url = process.env.BASE_URL;

const client = new line.Client(config);
const repromptMsg = 'パーカーですか？tシャツですか？'

module.exports = clova.Client
  .configureSkill()

  //起動時
  .onLaunchRequest(async responseHelper => {
    console.log('onLaunchRequest');
    
    const speech = [
        clova.SpeechBuilder.createSpeechUrl('https://clova-soundlib.line-scdn.net/clova_behavior_door_knock.mp3'),
        clova.SpeechBuilder.createSpeechUrl('https://clova-soundlib.line-scdn.net/clova_behavior_door_open.mp3'),
        clova.SpeechBuilder.createSpeechText('こんにちは！カフェマエマエへようこそ。ご希望の商品は' + repromptMsg)
      ];
    
    responseHelper.setSpeechList(speech);
    responseHelper.setReprompt(getRepromptMsg(clova.SpeechBuilder.createSpeechText(repromptMsg)));
  
  })

  //ユーザーからの発話が来たら反応する箇所
  .onIntentRequest(async responseHelper => {
    const intent = responseHelper.getIntentName();
    console.log('Intent:' + intent);
    switch (intent) {
      // ヘルプ
      case 'Clova.GuideIntent':
        const helpSpeech = [
          clova.SpeechBuilder.createSpeechText('スキルの説明をします。カフェマエマエで販売している商品を、こちらからご購入可能です。'),
          clova.SpeechBuilder.createSpeechText(repromptMsg)];
          responseHelper.setSpeechList(helpSpeech);
          responseHelper.setReprompt(getRepromptMsg(clova.SpeechBuilder.createSpeechText(repromptMsg)));
        break;
      
      case 'GoodsSearchIntent':
        const slots = responseHelper.getSlots();
        const goods = slots.goods;
        
        const goodsSpeech = [];
        console.log(slots.goods);
        
        // ユーザID取得
        const { userId } = responseHelper.getUser();

        // パーカーかtシャツの選択
        let goodsEn;
        if (goods === 'パーカー') {
          goodsEn = 'parker';
        } else if (goods === 'tシャツ') {
          goodsEn = 'tshirt';
        } else {
          goodsSpeech.push(clova.SpeechBuilder.createSpeechText('聞き取れませんでした。もう一度お願いします。' + repromptMsg));
          responseHelper.setSpeechList(goodsSpeech);
          return;
        }

        // オススメの商品をBOTへ送信
        await sendLineBot(userId, jsonData[goodsEn], goodsEn)
          .then(() => {
            if (goods === 'パーカー') {
              goodsSpeech.push(clova.SpeechBuilder.createSpeechText('パーカーのおすすめ商品をボットに送信しました。ご確認くださいませ。'));
            } else {
              goodsSpeech.push(clova.SpeechBuilder.createSpeechText('tシャツのおすすめ商品をボットに送信しました。ご確認くださいませ。'));
            }
          })
          .catch((err) => {
            console.log(err);
            goodsSpeech.push(clova.SpeechBuilder.createSpeechText('botを連携させてください。'));
          });
        
        goodsSpeech.push(clova.SpeechBuilder.createSpeechText('また、ご利用くださいませ。'));
        goodsSpeech.push(clova.SpeechBuilder.createSpeechUrl('https://clova-soundlib.line-scdn.net/clova_behavior_door_close.mp3'));
        responseHelper.setSpeechList(goodsSpeech);
        responseHelper.endSession();
        break;
        
      default:
        responseHelper.setSimpleSpeech(clova.SpeechBuilder.createSpeechText(repromptMsg));
        responseHelper.setReprompt(getRepromptMsg(clova.SpeechBuilder.createSpeechText(repromptMsg)));
        break;
    }
  })

  //終了時
  .onSessionEndedRequest(async responseHelper => {
    console.log('onSessionEndedRequest');
  })
  .handle();
  


// オススメの商品をBOTへ送信
async function sendLineBot(userId, jsonData, goodsEn) {
    await client.pushMessage(userId, [
      {
        "type": "flex",
        "altText": "商品を送信しました。",
        "contents": {
          "type": "carousel",
          "contents": await getPlanCarousel(jsonData, goodsEn)
        }
      }
    ]);
}


const getPlanJson = (jsonData, goodsEn) => {
  // LIFFで商品詳細
  const planLiff = "https://liff.line.me/" + process.env.PLAN_LIFF_ID + '?planId=' + jsonData.id;
  // jsonデータから商品を取得
  return {
    "type": "bubble",
    "size": "micro",
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "size": "sm",
          "text": jsonData.name
        }
      ]
    },
    "hero": {
      "type": "image",
      "url": base_url + jsonData.goodsImageUrl,
      "size": "full",
      "aspectRatio": "20:13",
      "aspectMode": "cover"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": jsonData.price
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
          "style": "secondary",
          "action": {
            "type": "uri",
            "label": "商品の詳細",
            "uri": planLiff
          }
        },
        {
          "type": "button",
          "style": "primary",
          "action": {
           "type":"postback",
           "label":"商品の購入",
           "data": "action=select&goods="+ goodsEn + "&planId=" + jsonData.id,
           "displayText":jsonData.name + "の商品を購入"
          }
        }
      ]
    },
    "styles": {
      "header": {
        "backgroundColor": "#00ffff"
      },
      "hero": {
        "separator": true,
        "separatorColor": "#000000"
      },
      "footer": {
        "separator": true,
        "separatorColor": "#000000"
      }
    }
  };
};

const getPlanCarousel = async(jsonData, goodsEn) => {
  const planJsons = [];
  const randomAry = await funcRandom(jsonData);
  for (let i = 0; i < 3; i++) {
    planJsons.push(getPlanJson(jsonData[randomAry[i]], goodsEn));
  }
  return planJsons;
};

// ランダム
async function funcRandom(data){
  let arr = [];
  for (let i=0; i<data.length; i++) {
    arr[i] = i;
  }
  let a = arr.length;
 
  // ランダムアルゴリズム
  while (a) {
      let j = Math.floor( Math.random() * a );
      let t = arr[--a];
      arr[a] = arr[j];
      arr[j] = t;
  }
   
  // ランダムされた配列の要素を順番に表示する
  await arr.forEach( function( value ) {} );
  return arr;
}


// リプロント
function getRepromptMsg(speechInfo){
  const speechObject = {
    type: "SimpleSpeech",
    values: speechInfo,
  };
  return speechObject;
}