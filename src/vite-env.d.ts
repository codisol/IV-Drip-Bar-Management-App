/// <reference types="vite/client" />

// Google API types
declare namespace google {
    namespace accounts {
        namespace oauth2 {
            interface TokenClient {
                callback: (response: TokenResponse) => void;
                requestAccessToken: (options?: { prompt?: string }) => void;
            }

            interface TokenResponse {
                access_token?: string;
                error?: string;
                error_description?: string;
                scope?: string;
                token_type?: string;
                expires_in?: number;
            }

            function initTokenClient(config: {
                client_id: string;
                scope: string;
                callback: (response: TokenResponse) => void;
                error_callback?: (error: { type: string; message: string }) => void;
            }): TokenClient;

            function revoke(token: string, callback?: () => void): void;
        }
    }
}

declare namespace gapi {
    function load(api: string, callback: () => void): void;

    namespace client {
        function init(config: { discoveryDocs?: string[] }): Promise<void>;
        function setToken(token: { access_token: string } | null): void;

        namespace drive {
            namespace files {
                function list(params: {
                    q?: string;
                    spaces?: string;
                    fields?: string;
                    pageSize?: number;
                }): Promise<{
                    result: {
                        files?: Array<{
                            id?: string;
                            name?: string;
                            modifiedTime?: string;
                            mimeType?: string;
                        }>;
                    };
                }>;

                function create(params: {
                    resource: {
                        name: string;
                        mimeType?: string;
                        parents?: string[];
                    };
                    fields?: string;
                }): Promise<{
                    result: {
                        id?: string;
                        name?: string;
                    };
                }>;

                function get(params: {
                    fileId: string;
                    alt?: string;
                }): Promise<{
                    body: string;
                }>;

                function update(params: {
                    fileId: string;
                    resource?: {
                        name?: string;
                    };
                    media?: {
                        mimeType: string;
                        body: string;
                    };
                }): Promise<{
                    result: {
                        id?: string;
                    };
                }>;
            }
        }
    }
}
