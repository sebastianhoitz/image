import { AllowlistOptions, Matcher } from 'allowlist';

interface ImageModifiers {
  width: number
  height: number
  fit: string
  format: string
  [key: string]: any
}

interface ImageOptions {
  provider?: string,
  preset?: string,
  modifiers?: Partial<ImageModifiers>
  [key: string]: any
}

// eslint-disable-next-line no-use-before-define
type ProviderGetImage = (src: string, options: ImageOptions, ctx: ImageCTX) => ResolvedImage

interface ImageProvider {
  defaults?: any
  getImage: ProviderGetImage
}

interface CreateImageOptions {
  providers: {
    [name: string]: {
      defaults: any,
      provider: ImageProvider
    }
  }
  presets: { [name: string]: ImageOptions }
  provider: string
  intersectOptions: object
  sizes?: (number | string)[]
  accept: AllowlistOptions
}

interface ImageInfo {
  width: number,
  height: number,
  placeholder?: string,
}

interface ResolvedImage {
  url: string,
  format?: string
  isStatic?: boolean
  getMeta?: () => Promise<ImageInfo>
}

interface $Img {
  (source: string, modifiers?: ImageOptions['modifiers'], options?: ImageOptions): ResolvedImage['url']
  options: CreateImageOptions
  getImage: (source: string, options?: ImageOptions) => ResolvedImage
  getSizes: (source: string, options?: ImageOptions, sizes?: string[]) => { width: string, height: string, src: string }[]
  getMeta: (source: string, options?: ImageOptions) => Promise<ImageInfo>
  [preset: string]: $Img['options'] | $Img['getImage'] | $Img['getSizes'] | $Img['getMeta'] | $Img /* preset */
}

interface ImageCTX {
  options: CreateImageOptions,
  accept: Matcher<any>
  nuxtContext: {
    ssrContext: any
    cache?: any
    isDev: boolean
    isStatic: boolean
    nuxtState?: any
  }
  $img?: $Img
}

interface InputProvider {
  name?: string
  provider?: string
  options?: any
  baseURL?: string
}

interface ImageProviders {
  cloudinary?: InputProvider,
  fastly?: InputProvider,
  imagekit?: InputProvider,
  imgix?: InputProvider,
  twicpics?: InputProvider,
}

interface ModuleOptions extends ImageProviders {
  provider: string
  presets: { [name: string]: ImageOptions }
  static: {
    baseURL: string
    dir: string
    clearCache: boolean | string
    cacheDir: string
    accept: string[]
    sharp: { [key: string]: any }
  }
  sizes?: (number|string)[],
  internalUrl?: string
  accept: any
  intersectOptions: object

  providers: { [name: string]: InputProvider | any } & ImageProviders
}

declare module '@nuxt/types' {
  interface Context {
    $img: $Img
  }

  interface NuxtAppOptions {
    $img: $Img
  }

  interface Configuration {
    image?: Partial<ModuleOptions>
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $img: $Img
  }
}

declare module 'vuex/types/index' {
  // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
  interface Store<S> {
    $img: $Img
  }
}

declare function imageModule(moduleOptions: ModuleOptions): Promise<void>;

export default imageModule;
