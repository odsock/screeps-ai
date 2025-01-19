declare const DEBUG: DEBUG;
declare const INFO: INFO;
declare const WARN: WARN;
declare const ERROR: ERROR;

type LogLevel = DEBUG | INFO | WARN | ERROR;

type DEBUG = 0;
type INFO = 1;
type WARN = 2;
type ERROR = 3;
