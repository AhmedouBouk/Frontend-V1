declare module 'geoportal-access-lib' {
  namespace Services {
    function getConfig(options: {
      apiKey: string;
      onSuccess: () => void;
      onFailure: (error: any) => void;
    }): void;

    function autoComplete(options: {
      text: string;
      apiKey: string;
      protocol: string;
      maximumResponses: number;
      filterOptions: {
        type: string[];
        territory: string[];
      };
      onSuccess: (results: {
        suggestedLocations: Array<{
          fullText: string;
          position: {
            x: number;
            y: number;
          };
          type: string;
          city?: string;
          street?: string;
          postalCode?: string;
        }>;
      }) => void;
      onFailure: (error: any) => void;
    }): void;
  }
}
