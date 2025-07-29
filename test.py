from PIL import Image, ImageOps
import os

# --- Configuration ---
INPUT_DIR = "src/assets/icons/"
OUTPUT_BASE_DIR = "src/assets/icons/processed/"
TARGET_SIZE = (24, 24) # Taille des icônes dans le cadre bleu
GREEN_COLOR = (16, 185, 129, 255) # Couleur verte pour l'état 'all' (RGBA)
WHITE_BACKGROUND = (255, 255, 255, 255) # Fond blanc pour l'état 'all' (RGBA)

# --- Création des dossiers de sortie ---
OUTPUT_ACTIVE_DIR = os.path.join(OUTPUT_BASE_DIR, "active")
OUTPUT_INACTIVE_DIR = os.path.join(OUTPUT_BASE_DIR, "inactive")
OUTPUT_ALL_DIR = os.path.join(OUTPUT_BASE_DIR, "all")

os.makedirs(OUTPUT_ACTIVE_DIR, exist_ok=True)
os.makedirs(OUTPUT_INACTIVE_DIR, exist_ok=True)
os.makedirs(OUTPUT_ALL_DIR, exist_ok=True)

print(f"Traitement des icônes depuis : {INPUT_DIR}")
print(f"Sortie vers : {OUTPUT_BASE_DIR}")

# --- Fonction de traitement d'une icône ---
def process_icon(icon_path):
    try:
        img = Image.open(icon_path).convert("RGBA")
        
        # Redimensionner l'image pour qu'elle tienne dans le cadre (24x24px)
        # Utilise ImageOps.contain pour maintenir les proportions et remplir le cadre
        resized_img = ImageOps.contain(img, TARGET_SIZE)

        # Créer une nouvelle image avec un fond transparent pour centrer l'icône
        final_img = Image.new("RGBA", TARGET_SIZE, (0, 0, 0, 0))
        offset_x = (TARGET_SIZE[0] - resized_img.width) // 2
        offset_y = (TARGET_SIZE[1] - resized_img.height) // 2
        final_img.paste(resized_img, (offset_x, offset_y), resized_img)

        base_name = os.path.basename(icon_path)
        
        # 1. Version 'active' (originale)
        final_img.save(os.path.join(OUTPUT_ACTIVE_DIR, base_name))
        
        # 2. Version 'inactive' (niveaux de gris)
        grayscale_img = final_img.convert("L").convert("RGBA") # Convertir en niveaux de gris puis RGBA pour la transparence
        grayscale_img.save(os.path.join(OUTPUT_INACTIVE_DIR, base_name))
        
        # 3. Version 'all' (verte sur fond blanc)
        # Créer une image verte avec la même forme que l'icône originale
        green_icon = Image.new("RGBA", final_img.size, GREEN_COLOR)
        
        # Utiliser le canal alpha de l'icône originale comme masque
        alpha_channel = final_img.split()[-1]
        
        # Créer un fond blanc
        white_bg = Image.new("RGBA", final_img.size, WHITE_BACKGROUND)
        
        # Coller l'icône verte sur le fond blanc en utilisant le masque
        white_bg.paste(green_icon, (0, 0), alpha_channel)
        
        white_bg.save(os.path.join(OUTPUT_ALL_DIR, base_name))
        
        print(f"  ✅ Traité : {base_name}")

    except Exception as e:
        print(f"  ❌ Erreur lors du traitement de {icon_path}: {e}")

# --- Lancement du traitement ---
for filename in os.listdir(INPUT_DIR):
    if filename.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp")):
        process_icon(os.path.join(INPUT_DIR, filename))

print("\nTraitement des icônes terminé.")
