import { Data, StreamChunk } from "@common";
import {
  SpeechifyClient,
  ClientState,
  SpeechifyClientEvent,
  ClientEventType,
} from "@common/client";

export default class SpeechifyClientImpl implements SpeechifyClient {
  playing: ClientState;
  host: string;
  utterance: SpeechSynthesisUtterance | null;
  listener?: (event: SpeechifyClientEvent) => void;

  constructor(host: string) {
    this.playing = ClientState.NOT_PLAYING;
    this.host = host;
    this.utterance = null;
  }

  async addToQueue(data: Data): Promise<boolean> {
    const resp = await fetch(`${this.host}/api/addToQueue`, {
      method: 'POST', body: JSON.stringify(data), headers: {'Content-Type': 'application/json'}
    })
    const result = await resp.json();
    if (this.playing === ClientState.PLAYING && this.utterance === null) {
      this.getNextChunk();
    }
    return result.success;
  }

  play(): void {
    if(this.utterance === null) {
      this.getNextChunk();
    }
    speechSynthesis.resume();

    this.playing = ClientState.PLAYING;
    this.listener?.({ type: ClientEventType.STATE, state: ClientState.PLAYING });
  }

  pause(): void {
    speechSynthesis.pause();
    this.playing = ClientState.NOT_PLAYING;
    this.listener?.({ type: ClientEventType.STATE, state: ClientState.NOT_PLAYING });
  }

  getState(): ClientState {
    if (!speechSynthesis.paused && speechSynthesis.speaking) {
      this.playing = ClientState.PLAYING;
    }
    return this.playing;
  }

  subscribe(listener: (event: SpeechifyClientEvent) => void): () => void {
    this.listener = listener;
    return () => { this.listener = undefined };
  }

  async getNextChunk(){
    const resp = await fetch(`${this.host}/api/getNextChunk`);
    const { chunk } = await resp.json();
    if (chunk?.data) {
      const utterance = new window.SpeechSynthesisUtterance(chunk?.data);
      utterance.lang = "en-US";
      utterance.rate = 0.9; 
      this.utterance = utterance;
      this.utterance.onend = () => { this.getNextChunk() }
      speechSynthesis.speak(utterance);
      speechSynthesis.resume();
    } else {
      this.utterance = null;
    }
  }
}
