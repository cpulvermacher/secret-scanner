export type Message = ScriptDetectedMessage | UserActionMessage;

export type ScriptDetectedMessage = {
    type: "scriptDetected";
    documentUrl: string; // page where the script was found
} & ScriptSource;

type ScriptSource =
    | {
          url: string; // source script URL
      }
    | {
          content: string;
      };

export type UserActionMessage = GetStatusMessage | SetIgnoredMessage;

export type GetStatusMessage = {
    type: "userAction";
    action: "getStatus";
    tabId: number;
};

/** mark a secret as ignored (or undo this) for the given site */
export type SetIgnoredMessage = {
    type: "userAction";
    action: "setIgnored";
    tabId: number;
    site: string;
    match: string;
    ignored: boolean;
};

export type UserAction = UserActionMessage["action"];
