import { DataType, Data, StreamChunk } from "@common";
import { SpeechifyServer } from "@common/server";
import { htmlToText } from 'html-to-text'


const parseHtml = (html: Data) => {
  const data = html.data;
  const text = htmlToText(data, {
    tags: {
      'a': { options: { baseUrl: html.source}}
    }
  });

  return `Reading website ${html.source}. \n${text}`;
}

const parseJson = (jsonData: Data) => {
  let txt = '';
  const json = JSON.parse(jsonData.data);
  if (jsonData.source === "https://slack.com/webhooks/chat" || jsonData.source === "webhooks.slack.messages") {
    txt = `Reading slack chat from ${json.from.substr(1)}, in ${json.channel.substr(1)} channel on ${new Date(json.timeSent).toLocaleString()}.\n${json.message}`;
  } else { // Fallback
    txt = `Reading JSON from ${jsonData.source}. \n ${jsonData}`;
  }

  return txt;
}

const parseTxt = (text: Data) => {
  let txt = '';
  if (text.source === 'feeds.stock-ticker') {
    const stockData = text.data.split('\n').map(stockEntry => {
      const [stock, price] = stockEntry.split('\t');
      const [dollar, cent] = price.split('.');
      return `${stock}, ${dollar} dollars and ${cent} cents.`;
    }).join('\n');
    txt = `Reading stock prices. \n ${stockData}`;
  } else { // Fallback
    txt = `Reading Text from ${text.source}.\n ${text.data}`;
  }

  return txt;
}


/**
 * Large content should be split into multiple small sentences for best experience.
 * So even if browser is closed and opened again, there will be less loss. For simplicity I am splitting sentences with new line "\n".
 */

const splitContent = (content: string) => {
  const lines = content.split('\n');
  const resultContent: Array<string> = [];

  while(lines.length > 0) {
    const line = lines.splice(0, 3).join('\n');
    resultContent.push(line);
  }

  return resultContent;
}

export default class MySpeechify implements SpeechifyServer {
  queue: Array<StreamChunk>;

  constructor() {
    this.queue = [];
  }

  addToQueue(data: Data): boolean {
    try {
      let formattedTxt = '';
      if (data.type === DataType.TXT) {
        formattedTxt = parseTxt(data);
      } else if (data.type === DataType.HTML) {
        formattedTxt = parseHtml(data);
      } else if (data.type === DataType.JSON) {
        formattedTxt = parseJson(data);
      }

      if (formattedTxt !== '') {
        const sentences = splitContent(formattedTxt);
        for (const sentence of sentences) {
          this.queue.push({ ...data, data: sentence });
        }
        return true;
      }
    } catch(e) {
      console.log(e);
    }

    return false;
  }

  getNextChunk(): StreamChunk | undefined {
    return this.queue.shift();
  }
}
