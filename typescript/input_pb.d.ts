import * as jspb from 'google-protobuf'



export class MouseMoveEvent extends jspb.Message {
  getX(): number;
  setX(value: number): MouseMoveEvent;

  getY(): number;
  setY(value: number): MouseMoveEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MouseMoveEvent.AsObject;
  static toObject(includeInstance: boolean, msg: MouseMoveEvent): MouseMoveEvent.AsObject;
  static serializeBinaryToWriter(message: MouseMoveEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MouseMoveEvent;
  static deserializeBinaryFromReader(message: MouseMoveEvent, reader: jspb.BinaryReader): MouseMoveEvent;
}

export namespace MouseMoveEvent {
  export type AsObject = {
    x: number;
    y: number;
  };
}

export class MouseButtonEvent extends jspb.Message {
  getButton(): number;
  setButton(value: number): MouseButtonEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MouseButtonEvent.AsObject;
  static toObject(includeInstance: boolean, msg: MouseButtonEvent): MouseButtonEvent.AsObject;
  static serializeBinaryToWriter(message: MouseButtonEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MouseButtonEvent;
  static deserializeBinaryFromReader(message: MouseButtonEvent, reader: jspb.BinaryReader): MouseButtonEvent;
}

export namespace MouseButtonEvent {
  export type AsObject = {
    button: number;
  };
}

export class MouseWheelEvent extends jspb.Message {
  getDeltaY(): number;
  setDeltaY(value: number): MouseWheelEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MouseWheelEvent.AsObject;
  static toObject(includeInstance: boolean, msg: MouseWheelEvent): MouseWheelEvent.AsObject;
  static serializeBinaryToWriter(message: MouseWheelEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MouseWheelEvent;
  static deserializeBinaryFromReader(message: MouseWheelEvent, reader: jspb.BinaryReader): MouseWheelEvent;
}

export namespace MouseWheelEvent {
  export type AsObject = {
    deltaY: number;
  };
}

export class KeyEvent extends jspb.Message {
  getKey(): string;
  setKey(value: string): KeyEvent;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): KeyEvent.AsObject;
  static toObject(includeInstance: boolean, msg: KeyEvent): KeyEvent.AsObject;
  static serializeBinaryToWriter(message: KeyEvent, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): KeyEvent;
  static deserializeBinaryFromReader(message: KeyEvent, reader: jspb.BinaryReader): KeyEvent;
}

export namespace KeyEvent {
  export type AsObject = {
    key: string;
  };
}

export class EmptyResponse extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): EmptyResponse.AsObject;
  static toObject(includeInstance: boolean, msg: EmptyResponse): EmptyResponse.AsObject;
  static serializeBinaryToWriter(message: EmptyResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): EmptyResponse;
  static deserializeBinaryFromReader(message: EmptyResponse, reader: jspb.BinaryReader): EmptyResponse;
}

export namespace EmptyResponse {
  export type AsObject = {
  };
}

