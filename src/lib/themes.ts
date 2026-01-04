export interface Theme {
    name: string;
    label: string;
    colors: {
        bg: string;   
        main: string; 
        sub: string;  
        text: string; 
        error: string;
    };
}

export const THEMES: Theme[] = [
    {
        name: 'zen_modern',
        label: 'Zen Modern',
        colors: {
            bg: '25 25 25',
            main: '216 180 254',
            sub: '113 113 122',
            text: '228 228 231',
            error: '239 68 68'
        }
    },
    {
        name: 'carbon',
        label: 'Carbon',
        colors: {
            bg: '49 49 49',
            main: '246 109 0',
            sub: '97 97 97',
            text: '245 229 200',
            error: '235 69 95'
        }
    },
    {
        name: 'serika_dark',
        label: 'Serika Dark',
        colors: {
            bg: '50 52 55',
            main: '226 183 20',
            sub: '100 102 105',
            text: '209 208 197',
            error: '202 71 84'
        }
    },
    {
        name: 'miami',
        label: 'Miami',
        colors: {
            bg: '24 24 24',
            main: '228 96 155',
            sub: '71 184 255',
            text: '240 240 240',
            error: '255 87 87'
        }
    },
    {
        name: 'dracula',
        label: 'Dracula',
        colors: {
            bg: '40 42 54',
            main: '189 147 249',
            sub: '98 114 164',
            text: '248 248 242',
            error: '255 85 85'
        }
    },
    {
        name: 'nord',
        label: 'Nord',
        colors: {
            bg: '46 52 64',
            main: '136 192 208',
            sub: '76 86 106',
            text: '216 222 233',
            error: '191 97 106'
        }
    },
    {
        name: 'gruvbox_dark',
        label: 'Gruvbox Dark',
        colors: {
            bg: '40 40 40',
            main: '215 153 33',
            sub: '168 153 132',
            text: '235 219 178',
            error: '204 36 29'
        }
    },
    {
        name: 'one_dark',
        label: 'One Dark',
        colors: {
            bg: '40 44 52',
            main: '97 175 239',
            sub: '92 99 112',
            text: '171 178 191',
            error: '224 108 117'
        }
    },
    {
        name: 'tokyo_night',
        label: 'Tokyo Night',
        colors: {
            bg: '26 27 38',
            main: '122 162 247',
            sub: '86 95 137',
            text: '169 177 214',
            error: '247 118 142'
        }
    },
    {
        name: 'botanical',
        label: 'Botanical',
        colors: {
            bg: '123 156 152',
            main: '255 255 255',
            sub: '73 94 91',
            text: '234 242 241',
            error: '255 107 107'
        }
    },
    {
        name: 'retro',
        label: 'Retro',
        colors: {
            bg: '218 211 193',
            main: '153 194 77',
            sub: '133 123 99',
            text: '75 70 56',
            error: '212 55 55'
        }
    },
    {
        name: 'matrix',
        label: 'Matrix',
        colors: {
            bg: '0 0 0',
            main: '21 255 0',
            sub: '0 100 0',
            text: '13 189 2',
            error: '255 0 0'
        }
    }
];
