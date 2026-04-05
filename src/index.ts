import {Context, h, Schema} from 'koishi'
import {} from 'http'

export const name = 'get-random-pig'

// zhu为默认触发词
const defaultCommand: string[] = ["祝", "猪", "好多猪", "好多祝", "🐖", "㊗️"];

export interface Config {
 pig?: string[],
  isMessagePig?: boolean,
}
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    help: Schema.boolean().default(false).description(`
# 插件使用说明

- 接上[PigHub](https://pighub.top)的随机猪猪群友图片插件

- 在群里有人发送你设置的猪猪触发词时返回一个随机猪猪！！！

- 找猪功能已部署，使用/找猪 （猪猪名）来尝试找到你想要的猪猪吧

使用示例： \`/找猪 猪睡觉\`、\`/猪\`
    `).role('label')
  }).description('使用说明'),

  Schema.object({
    isMessagePig: Schema.boolean().default(true)
      .description(`开启群友发触发词后一键发猪猪`)
  }).description('发猪猪设置'),

  Schema.object({
    pig: Schema.array(
      Schema.string()
        .required()
    )
        .description('好多猪')
        .role('table')
        .default(defaultCommand)
    })
      .role("table")
      .description("猪猪的触发词"),

  ])

export const inject = {
  required: ['http'],
}

// PigHub的图片json
interface ImageJson {
  "id": string,
  "thumbnail": string,
  "mtime": number,
  "duration": string,
  "filename": string,
  "download_count": number,
  "title": string,
  "image_type": string,
  "view_count": number,
}

interface ImageCache {
  images: ImageJson[],
  ids: string[],
  lastUpdated: Date
}

let imageCache : ImageCache = {
  images: [],
  ids: [],
  lastUpdated: null
};

const isCacheEmpty = () => {
  return imageCache.images.length === 0;
};

const getRandomImage = () => {
  if (isCacheEmpty()) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * imageCache.images.length);
  return imageCache.images[randomIndex];
};

const getSearchImage = (pigName : string) => {
  if (isCacheEmpty()) return null;

  const relatedImages = imageCache.images.filter(img =>
    img.title.toLowerCase().includes(pigName.toLowerCase()) ||
    (img.filename && img.filename.toLowerCase().includes(pigName.toLowerCase()))
  );

  if (relatedImages.length === 0) return null;
  return relatedImages[Math.floor(Math.random() * relatedImages.length)];

}

let intervalId = null;




export function apply(ctx: Context, config: Config) {
  // write your plugin here

  const getAllImages = async () => {
    try {


      const response = await ctx.http.get(
        `https://pighub.top/api/all-images`
      );

      if (response && response.total > 0) {
        imageCache = {
          images: response.images,
          ids: response.images.map(i => i.id),
          lastUpdated: new Date()
        };
        return true;
      } else {
        return false;
      }
    }catch (e){
      ctx.logger("pig-getRandomImage").error(`PigHub访问失败了...\n${e}`);
      return false;
    }
  };


  const startCacheUpdateInterval = () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    // 24小时 = 24 * 60 * 60 * 1000 = 86400000 毫秒
    intervalId = setInterval(async () => {
      await getAllImages();
      ctx.logger("pig-update").info(`${new Date().toISOString()} 更新了哦`)
    }, 24 * 60 * 60 * 1000);

  };

  enum GetImageType {
    randomImage,
    searchImage
  }

  async function getImage(actionType : GetImageType, pigName : string = '') {
    if (isCacheEmpty()) {
      const success = await getAllImages();
      if (!success) {
        return "🐖迷路了";
      }
    }
    let image : ImageJson | null;

    if (actionType == GetImageType.randomImage)
      image = getRandomImage();
    else if (actionType == GetImageType.searchImage)
      image = getSearchImage(pigName);

    if (!image) {
      return "没有🐖了";
    }

    const picName = image.thumbnail;


    return h('img', {
      src: `https://pighub.top${picName}`
    })
  }

  let pigName = config.pig || ["zhu"]
  ctx.on("ready", ()=>{
    startCacheUpdateInterval();
  })

  ctx.on("dispose", ()=>{
    clearInterval(intervalId);
  })

  ctx.on("message", async (session) => {
  })

  ctx.command("猪").action(async (_) => await getImage(GetImageType.randomImage));

  ctx.command("找猪", "message").action(async (_, message) => await getImage(GetImageType.searchImage, message));

  if (config.isMessagePig)
  ctx.middleware(async (session, next) => {
    if (pigName.includes(session.content)) {
      return await getImage(GetImageType.randomImage);
    } else return next();
  }, true);

}
