export const blockedStorageNotice:string;
export interface SaveStatusView {
  blocked():boolean;
  refused():void;
  saved():void;
  action(text:string,options?:{saved?:boolean}):void;
}
export function createSaveStatus(status:Element,message:Element):SaveStatusView;
