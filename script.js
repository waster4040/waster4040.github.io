class ModelViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.mixer = null;
        this.clock = new THREE.Clock();
        this.animationSpeed = 1.0;
        this.isPlaying = true;
        this.autoRotate = false;
        this.availableModels = [];
        this.currentModelName = null;

        // DOM要素の存在確認
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) {
            console.error('canvas-container要素が見つかりません');
            return;
        }

        this.init();
        this.setupModelList();
        this.setupEventListeners();
        this.animate();



        // 非同期でモデルリストを更新
        this.loadAvailableModels();
    }

    init() {
        // シーンの作成
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        // カメラの作成
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(5, 5, 5);

        // レンダラーの作成
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.physicallyCorrectLights = true;

        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // コントロールの作成
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 100;

        // ホイールズームを無効にする
        this.controls.enableZoom = false;

        // ライティングの設定
        this.setupLighting();

        // リサイズイベント
        window.addEventListener('resize', () => this.onWindowResize());

        // ダブルタップでカメラリセット機能を設定
        this.setupDoubleTapReset();

        // ハンバーガーメニューの設定
        this.setupHamburgerMenu();

        // ピンチズーム機能の設定
        this.setupPinchZoom();
    }

    setupLighting() {
        // 環境光
        const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
        this.scene.add(ambientLight);

        // 指向性ライト
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        directionalLight.shadow.bias = -0.0001;
        this.scene.add(directionalLight);

        // ポイントライト
        const pointLight1 = new THREE.PointLight(0xff6b6b, 1.2, 50);
        pointLight1.position.set(-10, 10, -10);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x4ecdc4, 1.2, 50);
        pointLight2.position.set(10, -10, 10);
        this.scene.add(pointLight2);


    }

    async loadAvailableModels() {
        try {
            // modelsフォルダーの内容を取得
            const response = await fetch('models/');
            const text = await response.text();

            // HTMLから.gltf, .glb, .fbxファイルを抽出
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const links = doc.querySelectorAll('a[href]');

            const modelFiles = [];
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && (href.endsWith('.gltf') || href.endsWith('.glb') || href.endsWith('.fbx'))) {
                    try {
                        // URLデコードして日本語ファイル名を正しく処理
                        const decodedHref = decodeURIComponent(href);
                        const fileName = decodedHref.split('/').pop();
                        const displayName = fileName.replace(/\.(gltf|glb|fbx)$/i, '');
                        modelFiles.push({
                            name: displayName,
                            path: `models/${encodeURIComponent(fileName)}`
                        });
                    } catch (decodeError) {
                        // デコードに失敗した場合は元のファイル名を使用
                        console.warn('ファイル名のデコードに失敗:', href, decodeError);
                        const fileName = href.split('/').pop();
                        const displayName = fileName.replace(/\.(gltf|glb|fbx)$/i, '');
                        modelFiles.push({
                            name: displayName,
                            path: `models/${fileName}`
                        });
                    }
                }
            });

            // 見つかったモデルファイルを追加
            this.availableModels = [...modelFiles];

        } catch (error) {
            console.warn('modelsフォルダーの読み込みに失敗しました:', error);
            // フォールバック: 既知のファイルをチェック
            await this.checkKnownModels();
        }

        // モデルリストを設定
        this.setupModelList();
    }

    async checkKnownModels() {
        // 一般的なモデルファイル名をチェック（日本語ファイル名も含む）
        const commonFiles = [
            'cube.gltf', 'cube.glb',
            'sphere.gltf', 'sphere.glb',
            'model.gltf', 'model.glb',
            'scene.gltf', 'scene.glb',
            'test.gltf', 'test.glb',
            'sample.gltf', 'sample.glb',
            // 日本語ファイル名の例
            'ミラーボール2.0.glb',
            'テストモデル.gltf',
            'サンプル.glb'
        ];

        for (const fileName of commonFiles) {
            try {
                // 日本語ファイル名の場合はエンコードしてリクエスト
                const encodedFileName = encodeURIComponent(fileName);
                const response = await fetch(`models/${encodedFileName}`, { method: 'HEAD' });
                if (response.ok) {
                    const displayName = fileName.replace(/\.(gltf|glb|fbx)$/i, '');
                    // 重複チェック
                    const exists = this.availableModels.some(model =>
                        model.name === displayName ||
                        model.path === `models/${encodedFileName}` ||
                        model.path === `models/${fileName}`
                    );
                    if (!exists) {
                        this.availableModels.push({
                            name: displayName,
                            path: `models/${encodedFileName}`
                        });
                    }
                }
            } catch (error) {
                // ファイルが存在しない場合は無視
            }
        }
    }

    setupModelList() {
        const select = document.getElementById('model-select');

        if (!select) {
            console.warn('model-select要素が見つかりません');
            return;
        }

        // 既存のオプションをクリア
        while (select.children.length > 0) {
            select.removeChild(select.lastChild);
        }

        this.availableModels.forEach((model, index) => {
            const option = document.createElement('option');
            option.value = index;
            // 日本語文字が正しく表示されるようにする
            option.textContent = model.name;
            option.title = model.name; // ツールチップにも表示
            select.appendChild(option);
        });

        // 最初のモデルがある場合は自動選択
        if (this.availableModels.length > 0) {
            select.value = 0;
            this.currentModelName = this.availableModels[0].name;
            if (this.availableModels[0].path) {
                this.loadModelFromPath(this.availableModels[0].path);
            }
        }

        console.log('利用可能なモデル:', this.availableModels.map(m => m.name));
    }



    adjustCameraToModel(model) {
        if (!model) return;

        // モデルのバウンディングボックスを計算
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // モデルの最大サイズを取得
        const maxDim = Math.max(size.x, size.y, size.z);

        // カメラの距離を計算（モデルサイズに基づく）
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = Math.abs(maxDim / Math.sin(fov / 2)) * 0.5; // もっと近づくように調整

        // カメラの位置を設定（斜め上から見下ろす角度）
        const cameraPosition = new THREE.Vector3(
            center.x + distance * 0.7,
            center.y + distance * 0.7,
            center.z + distance * 0.7
        );

        // カメラの位置を滑らかに移動
        this.animateCameraTo(cameraPosition, center);

        // OrbitControlsのターゲットを更新
        this.controls.target.copy(center);
        this.controls.update();

        console.log(`モデルサイズ: ${maxDim.toFixed(2)}, カメラ距離: ${distance.toFixed(2)}`);
    }

    animateCameraTo(targetPosition, lookAtTarget) {
        const startPosition = this.camera.position.clone();
        const startTime = Date.now();
        const duration = 1000; // 1秒でアニメーション

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // イージング関数（スムーズな動き）
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            // カメラ位置を補間
            this.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);

            // カメラの向きを更新
            this.camera.lookAt(lookAtTarget);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }



    loadModelFromPath(path) {
        const loading = document.getElementById('loading');
        loading.style.display = 'block';

        // 既存のモデルを削除
        if (this.model) {
            this.scene.remove(this.model);
        }
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }

        const loader = new THREE.GLTFLoader();

        loader.load(
            path,
            (gltf) => {
                this.model = gltf.scene;
                this.scene.add(this.model);

                // モデルのサイズを正規化
                const box = new THREE.Box3().setFromObject(this.model);
                const size = box.getSize(new THREE.Vector3()).length();
                const center = box.getCenter(new THREE.Vector3());

                this.model.position.x += (this.model.position.x - center.x);
                this.model.position.y += (this.model.position.y - center.y);
                this.model.position.z += (this.model.position.z - center.z);

                const scale = 4 / size;
                this.model.scale.setScalar(scale);

                // アニメーションの設定
                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(this.model);
                    gltf.animations.forEach((clip) => {
                        const action = this.mixer.clipAction(clip);
                        action.play();
                    });
                }

                // シャドウとマテリアルの設定
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        // マテリアルの品質向上
                        if (child.material) {
                            if (child.material.map) {
                                child.material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                            }
                            if (child.material.normalMap) {
                                child.material.normalMap.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                            }
                            if (child.material.roughnessMap) {
                                child.material.roughnessMap.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                            }
                            if (child.material.metalnessMap) {
                                child.material.metalnessMap.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                            }
                        }
                    }
                });

                // カメラ位置を調整
                this.adjustCameraToModel(this.model);

                loading.style.display = 'none';
            },
            (progress) => {
                console.log('Loading progress:', progress);
            },
            (error) => {
                console.error('Error loading model:', error);
                loading.style.display = 'none';
                alert('モデルの読み込みに失敗しました。');
            }
        );
    }

    setupEventListeners() {
        // モデル選択
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', (event) => {
                const selectedIndex = parseInt(event.target.value);
                if (!isNaN(selectedIndex)) {
                    const selectedModel = this.availableModels[selectedIndex];
                    if (selectedModel && selectedModel.path) {
                        this.currentModelName = selectedModel.name;
                        this.loadModelFromPath(selectedModel.path);
                    }
                }
            });
        }

        // 背景色RGB調整
        this.setupBackgroundColorControls();

        // 再生/一時停止
        const playPauseBtn = document.getElementById('play-pause');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.isPlaying = !this.isPlaying;
                playPauseBtn.textContent = this.isPlaying ? '一時停止' : '再生';
            });
        }



        // 自動回転
        const autoRotateBtn = document.getElementById('auto-rotate');
        if (autoRotateBtn) {
            autoRotateBtn.addEventListener('click', () => {
                this.autoRotate = !this.autoRotate;
                this.controls.autoRotate = this.autoRotate;
                autoRotateBtn.textContent = this.autoRotate ? '自動回転停止' : '自動回転';
            });
        }

        // モデルリスト更新
        const refreshBtn = document.getElementById('refresh-models');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshModelList();
            });
        }

        // 作品説明ボタン
        const descriptionBtn = document.getElementById('show-description');
        if (descriptionBtn) {
            descriptionBtn.addEventListener('click', () => {
                this.showDescription();
            });
        }

        // 作品説明ポップアップの閉じるボタン
        const closeDescriptionBtn = document.getElementById('close-description');
        if (closeDescriptionBtn) {
            closeDescriptionBtn.addEventListener('click', () => {
                this.hideDescription();
            });
        }

        // ポップアップの背景をクリックして閉じる
        const descriptionPopup = document.getElementById('description-popup');
        if (descriptionPopup) {
            descriptionPopup.addEventListener('click', (event) => {
                if (event.target === descriptionPopup) {
                    this.hideDescription();
                }
            });
        }
    }

    // モデルリストを手動で更新するメソッド
    async refreshModelList() {
        await this.loadAvailableModels();
        console.log('モデルリストを更新しました');
    }

    // ダブルタップでカメラリセット機能を設定
    setupDoubleTapReset() {
        let lastTapTime = 0;
        const doubleTapDelay = 300; // 300ms以内のタップをダブルタップとして認識

        const handleDoubleTap = (event) => {
            const currentTime = Date.now();
            const timeDiff = currentTime - lastTapTime;

            if (timeDiff < doubleTapDelay && timeDiff > 0) {
                // ダブルタップが検出された
                event.preventDefault();
                this.resetCamera();
                console.log('ダブルタップでカメラリセット');
            }

            lastTapTime = currentTime;
        };

        // レンダラーが存在することを確認してからイベントリスナーを追加
        if (this.renderer && this.renderer.domElement) {
            // マウスとタッチの両方に対応
            this.renderer.domElement.addEventListener('click', handleDoubleTap);
            this.renderer.domElement.addEventListener('touchend', handleDoubleTap);
        }
    }

    // カメラリセット機能
    resetCamera() {
        if (this.model) {
            // 現在のモデルに合わせてカメラ位置を調整
            this.adjustCameraToModel(this.model);
        } else {
            // モデルがない場合はデフォルト位置
            this.camera.position.set(5, 5, 5);
            this.controls.target.set(0, 0, 0);
            this.controls.reset();
        }
    }

    // ハンバーガーメニューの設定
    setupHamburgerMenu() {
        const hamburgerIcon = document.getElementById('hamburger-icon');
        const controlsPanel = document.getElementById('controls-panel');

        if (hamburgerIcon && controlsPanel) {
            let isMenuOpen = false;

            hamburgerIcon.addEventListener('click', () => {
                isMenuOpen = !isMenuOpen;

                if (isMenuOpen) {
                    hamburgerIcon.classList.add('active');
                    controlsPanel.classList.add('show');
                } else {
                    hamburgerIcon.classList.remove('active');
                    controlsPanel.classList.remove('show');
                }
            });

            // メニュー外をクリックした時にメニューを閉じる
            document.addEventListener('click', (event) => {
                if (isMenuOpen &&
                    !controlsPanel.contains(event.target) &&
                    !hamburgerIcon.contains(event.target)) {
                    isMenuOpen = false;
                    hamburgerIcon.classList.remove('active');
                    controlsPanel.classList.remove('show');
                }
            });

            // ESCキーでメニューを閉じる
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    // 作品説明ポップアップが開いている場合は閉じる
                    const descriptionPopup = document.getElementById('description-popup');
                    if (descriptionPopup && descriptionPopup.classList.contains('show')) {
                        this.hideDescription();
                        return;
                    }

                    // ハンバーガーメニューが開いている場合は閉じる
                    if (isMenuOpen) {
                        isMenuOpen = false;
                        hamburgerIcon.classList.remove('active');
                        controlsPanel.classList.remove('show');
                    }
                }
            });
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    // ピンチズーム機能の設定
    setupPinchZoom() {
        let initialDistance = 0;
        let initialCameraDistance = 0;

        const getTouchDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const getCameraDistance = () => {
            return this.camera.position.distanceTo(this.controls.target);
        };

        // タッチ開始
        this.renderer.domElement.addEventListener('touchstart', (event) => {
            if (event.touches.length === 2) {
                // 二本指タッチの場合
                event.preventDefault();
                initialDistance = getTouchDistance(event.touches);
                initialCameraDistance = getCameraDistance();

                // OrbitControlsを一時的に無効にする
                this.controls.enabled = false;
            } else if (event.touches.length === 1) {
                // 一本指の場合はOrbitControlsを有効にする
                this.controls.enabled = true;
            }
        }, { passive: false });

        // タッチ移動
        this.renderer.domElement.addEventListener('touchmove', (event) => {
            if (event.touches.length === 2) {
                event.preventDefault();

                const currentDistance = getTouchDistance(event.touches);
                
                // 初期距離が0の場合は処理をスキップ
                if (initialDistance === 0) return;
                
                const scale = currentDistance / initialDistance;

                // ズーム倍率を計算（直感的な操作にする）
                const zoomFactor = 1 / scale;
                const newDistance = initialCameraDistance * zoomFactor;

                // 距離の制限
                const clampedDistance = Math.max(
                    this.controls.minDistance,
                    Math.min(this.controls.maxDistance, newDistance)
                );

                // カメラ位置を更新
                const direction = new THREE.Vector3()
                    .subVectors(this.camera.position, this.controls.target)
                    .normalize();

                this.camera.position.copy(
                    this.controls.target.clone().add(direction.multiplyScalar(clampedDistance))
                );
            }
        }, { passive: false });

        // タッチ終了
        this.renderer.domElement.addEventListener('touchend', (event) => {
            if (event.touches.length < 2) {
                // 二本指が離れた場合、OrbitControlsを再度有効にする
                this.controls.enabled = true;
            }
        });

        // タッチキャンセル
        this.renderer.domElement.addEventListener('touchcancel', (event) => {
            this.controls.enabled = true;
        });

        // マウスホイールイベントを完全に無効化
        this.renderer.domElement.addEventListener('wheel', (event) => {
            event.preventDefault();
        }, { passive: false });
    }

    // 作品説明を表示
    showDescription() {
        if (!this.currentModelName) {
            alert('モデルが選択されていません。');
            return;
        }

        const descriptionPopup = document.getElementById('description-popup');
        const descriptionImage = document.getElementById('description-image');

        if (descriptionPopup && descriptionImage) {
            // 画像のパスを設定（captionsフォルダ内の同名PNG画像）
            const imagePath = `captions/${encodeURIComponent(this.currentModelName)}.png`;

            // 画像の読み込みを試行
            const img = new Image();
            img.onload = () => {
                descriptionImage.src = imagePath;
                descriptionPopup.classList.add('show');

                // ハンバーガーメニューを閉じる
                const hamburgerIcon = document.getElementById('hamburger-icon');
                const controlsPanel = document.getElementById('controls-panel');
                if (hamburgerIcon && controlsPanel) {
                    hamburgerIcon.classList.remove('active');
                    controlsPanel.classList.remove('show');
                }
            };
            img.onerror = () => {
                alert(`作品説明画像が見つかりません: ${this.currentModelName}.png`);
            };
            img.src = imagePath;
        }
    }

    // 作品説明を非表示
    hideDescription() {
        const descriptionPopup = document.getElementById('description-popup');
        if (descriptionPopup) {
            descriptionPopup.classList.remove('show');
        }
    }

    // 背景色RGB調整機能の設定
    setupBackgroundColorControls() {
        const redSlider = document.getElementById('bg-red');
        const greenSlider = document.getElementById('bg-green');
        const blueSlider = document.getElementById('bg-blue');

        if (redSlider && greenSlider && blueSlider) {
            const updateBackgroundColor = () => {
                const r = parseInt(redSlider.value);
                const g = parseInt(greenSlider.value);
                const b = parseInt(blueSlider.value);

                // RGB値を0-1の範囲に正規化してThree.jsのColorに設定
                const color = new THREE.Color(r / 255, g / 255, b / 255);
                this.scene.background = color;
            };

            // 各スライダーにイベントリスナーを追加
            redSlider.addEventListener('input', updateBackgroundColor);
            greenSlider.addEventListener('input', updateBackgroundColor);
            blueSlider.addEventListener('input', updateBackgroundColor);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // アニメーションの更新
        if (this.mixer && this.isPlaying) {
            this.mixer.update(delta * this.animationSpeed);
        }

        // コントロールの更新
        this.controls.update();

        // レンダリング
        this.renderer.render(this.scene, this.camera);
    }
}

// アプリケーションの開始
document.addEventListener('DOMContentLoaded', () => {
    // DOMが完全に読み込まれてからModelViewerを初期化
    setTimeout(() => {
        new ModelViewer();
    }, 100); // 100ms待機してDOM要素が確実に利用可能になるまで待つ
});